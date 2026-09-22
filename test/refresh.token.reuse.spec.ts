import { expect } from "chai";
import { describe, it, afterEach } from "mocha";
import type { Request, Response } from "express";
import AuthController from "../src/controllers/user.auth.controller";
import { createRefreshToken, verifyRefreshToken } from "../src/utils/jwt";
import RefreshSessionStore from "../src/utils/refresh.session.store";

/**
 * MERGE_HARDENING_PLAN.md Blocker 2 — Refresh Token Reuse Protection.
 *
 * Exercises AuthController.refresh/logout against a stubbed
 * RefreshSessionStore (same stubbing style as
 * terminal.echo.creation.spec.ts) so these scenarios are deterministic
 * regardless of whether a real Redis instance happens to be reachable
 * in the environment running the suite.
 */
describe("Refresh Token Reuse Protection (§Blocker 2)", () => {
  const originals: Array<() => void> = [];
  afterEach(() => {
    while (originals.length) originals.pop()!();
  });

  const stub = <T extends object, K extends keyof T>(obj: T, key: K, fn: unknown) => {
    const original = obj[key];
    (obj as Record<K, unknown>)[key] = fn;
    originals.push(() => {
      obj[key] = original;
    });
  };

  const fakeRes = () => {
    let status = 0;
    let body: any = null;
    const res = {
      status: (code: number) => {
        status = code;
        return {
          json: (data: any) => {
            body = data;
          },
        };
      },
    } as unknown as Response;
    return { res, getStatus: () => status, getBody: () => body };
  };

  const mintTrackedRefreshToken = (fam: string) => {
    const token = createRefreshToken({ userId: "650000000000000000000099", email: "t@t.com", fam });
    const { jti } = verifyRefreshToken(token);
    return { token, jti: jti as string };
  };

  it("rotates successfully for a token whose jti is registered as 'valid', marks it rotated, and registers the new one under the SAME family", async () => {
    stub(RefreshSessionStore, "isAvailable", () => true);
    const { token, jti } = mintTrackedRefreshToken("fam-1");

    stub(RefreshSessionStore, "isFamilyRevoked", async () => false);
    stub(RefreshSessionStore, "getToken", async (id: string) => {
      expect(id).to.equal(jti);
      return { userId: "650000000000000000000099", familyId: "fam-1", status: "valid" };
    });
    let markedRotatedJti: string | null = null;
    stub(RefreshSessionStore, "markRotated", async (id: string) => {
      markedRotatedJti = id;
    });
    let registeredFamily: string | null = null;
    stub(RefreshSessionStore, "registerValid", async (params: { familyId: string }) => {
      registeredFamily = params.familyId;
    });

    const { res, getStatus, getBody } = fakeRes();
    await AuthController.refresh(
      { body: { refreshToken: token } } as unknown as Request,
      res
    );

    expect(getStatus()).to.equal(200);
    expect(getBody()).to.have.property("refreshToken");
    expect(getBody().refreshToken).to.not.equal(token);
    expect(markedRotatedJti).to.equal(jti);
    expect(registeredFamily).to.equal("fam-1");
  });

  it("rejects and revokes the whole family when a token already marked 'rotated' is presented again (reuse)", async () => {
    stub(RefreshSessionStore, "isAvailable", () => true);
    const { token } = mintTrackedRefreshToken("fam-2");

    stub(RefreshSessionStore, "isFamilyRevoked", async () => false);
    stub(RefreshSessionStore, "getToken", async () => ({
      userId: "650000000000000000000099",
      familyId: "fam-2",
      status: "rotated",
    }));
    let revokedFamily: string | null = null;
    stub(RefreshSessionStore, "revokeFamily", async (fam: string) => {
      revokedFamily = fam;
    });
    let registerValidCalled = false;
    stub(RefreshSessionStore, "registerValid", async () => {
      registerValidCalled = true;
    });

    const { res, getStatus, getBody } = fakeRes();
    await AuthController.refresh(
      { body: { refreshToken: token } } as unknown as Request,
      res
    );

    expect(getStatus()).to.equal(401);
    expect(getBody()).to.deep.equal({ message: "Refresh token reuse detected. Please log in again." });
    expect(revokedFamily).to.equal("fam-2");
    // A reused token must never mint fresh credentials.
    expect(registerValidCalled).to.equal(false);
  });

  it("rejects with 401 when the family was already revoked, even for a structurally-valid, unexpired token", async () => {
    stub(RefreshSessionStore, "isAvailable", () => true);
    const { token } = mintTrackedRefreshToken("fam-3");

    stub(RefreshSessionStore, "isFamilyRevoked", async (fam: string) => {
      expect(fam).to.equal("fam-3");
      return true;
    });
    let getTokenCalled = false;
    stub(RefreshSessionStore, "getToken", async () => {
      getTokenCalled = true;
      return null;
    });

    const { res, getStatus, getBody } = fakeRes();
    await AuthController.refresh(
      { body: { refreshToken: token } } as unknown as Request,
      res
    );

    expect(getStatus()).to.equal(401);
    expect(getBody()).to.deep.equal({ message: "Session revoked. Please log in again." });
    // Revocation is checked before consulting the individual token record.
    expect(getTokenCalled).to.equal(false);
  });

  it("proceeds without penalty when no jti record exists yet (transient Redis gap), and self-heals by registering the new token", async () => {
    stub(RefreshSessionStore, "isAvailable", () => true);
    const { token } = mintTrackedRefreshToken("fam-4");

    stub(RefreshSessionStore, "isFamilyRevoked", async () => false);
    stub(RefreshSessionStore, "getToken", async () => null);
    let markRotatedCalled = false;
    stub(RefreshSessionStore, "markRotated", async () => {
      markRotatedCalled = true;
    });
    let registeredFamily: string | null = null;
    stub(RefreshSessionStore, "registerValid", async (params: { familyId: string }) => {
      registeredFamily = params.familyId;
    });

    const { res, getStatus } = fakeRes();
    await AuthController.refresh(
      { body: { refreshToken: token } } as unknown as Request,
      res
    );

    expect(getStatus()).to.equal(200);
    // Nothing to mark rotated — there was no prior record.
    expect(markRotatedCalled).to.equal(false);
    // But the new token is still registered so future rotations are tracked.
    expect(registeredFamily).to.equal("fam-4");
  });

  it("grandfathers a pre-existing token with no fam claim into a brand-new family instead of rejecting it", async () => {
    stub(RefreshSessionStore, "isAvailable", () => true);
    // No `fam` passed — simulates a refresh token minted before this feature shipped.
    const legacyToken = createRefreshToken({ userId: "650000000000000000000099", email: "t@t.com" });

    let isFamilyRevokedCalled = false;
    stub(RefreshSessionStore, "isFamilyRevoked", async () => {
      isFamilyRevokedCalled = true;
      return false;
    });
    let registeredFamily: string | null = null;
    stub(RefreshSessionStore, "registerValid", async (params: { familyId: string }) => {
      registeredFamily = params.familyId;
    });

    const { res, getStatus, getBody } = fakeRes();
    await AuthController.refresh(
      { body: { refreshToken: legacyToken } } as unknown as Request,
      res
    );

    expect(getStatus()).to.equal(200);
    expect(getBody()).to.have.property("refreshToken");
    // No prior family to check revocation against.
    expect(isFamilyRevokedCalled).to.equal(false);
    // A fresh family was minted and the new token registered under it.
    expect(registeredFamily).to.be.a("string");
    expect(registeredFamily).to.not.equal(null);
  });

  it("logout revokes the session family when a refresh token is presented", async () => {
    const { token } = mintTrackedRefreshToken("fam-5");
    let revokedFamily: string | null = null;
    stub(RefreshSessionStore, "revokeFamily", async (fam: string) => {
      revokedFamily = fam;
    });

    const clearedCookies: string[] = [];
    const res = {
      clearCookie: (name: string) => {
        clearedCookies.push(name);
      },
      status: (code: number) => ({
        json: () => ({ code }),
      }),
    } as unknown as Response;

    await AuthController.logout(
      { cookies: { refresh_token: token }, body: {} } as unknown as Request,
      res
    );

    expect(revokedFamily).to.equal("fam-5");
    expect(clearedCookies).to.include("session_token");
    expect(clearedCookies).to.include("refresh_token");
  });

  it("logout does not attempt revocation when no refresh token is presented", async () => {
    let revokeCalled = false;
    stub(RefreshSessionStore, "revokeFamily", async () => {
      revokeCalled = true;
    });

    const res = {
      clearCookie: () => {},
      status: () => ({ json: () => {} }),
    } as unknown as Response;

    await AuthController.logout({ cookies: {}, body: {} } as unknown as Request, res);

    expect(revokeCalled).to.equal(false);
  });
});
