import { expect } from "chai";
import { describe, it } from "mocha";
import type { Request, Response } from "express";
import AuthController from "../src/controllers/user.auth.controller";
import { createRefreshToken, verifyRefreshToken } from "../src/utils/jwt";
import RefreshSessionStore from "../src/utils/refresh.session.store";

/**
 * MERGE_HARDENING_PLAN.md Blocker 2 — end-to-end behavioral verification.
 *
 * Unlike refresh.token.reuse.spec.ts (which stubs RefreshSessionStore
 * to test each branch of AuthController.refresh in isolation), this
 * file exercises the REAL store against a real Redis connection,
 * driving actual multi-hop rotation chains through AuthController.refresh
 * exactly as a client would. It's the direct behavioral proof requested
 * for the merge gate: "A → B, reuse A → reject" and "B → C, reuse B →
 * reject" — the second scenario specifically proves detection works on
 * a token in the MIDDLE of a chain, not just the first one ever issued.
 *
 * Skips gracefully if this environment has no reachable Redis, since
 * without it RefreshSessionStore's fail-open design means rotation
 * still works but reuse detection is inert (nothing to prove here).
 *
 * RedisUtil connects asynchronously as a fire-and-forget side effect
 * of importing app.ts (see setup.ts) — there's no hook anywhere that
 * awaits it. Polling briefly here (instead of a single synchronous
 * check) avoids a false skip if this file happens to run early,
 * before that connection has finished establishing.
 *
 * Deliberately avoids Mocha-only hook features (`this.skip()`,
 * `this.timeout()`): this suite runs under both Mocha and Vitest via
 * setup.vitest.ts's `before -> beforeAll` alias, and Vitest's hook
 * callbacks don't get a Mocha-style `this`. The bound stays well
 * under Mocha's 2000ms default hook timeout, and each test checks the
 * shared flag itself rather than relying on a runner-specific skip.
 */
let redisReachable = false;

describe("Refresh Token Reuse Protection — real end-to-end chain (§Blocker 2)", () => {
  before(async () => {
    const deadline = Date.now() + 1500;
    while (!RefreshSessionStore.isAvailable() && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    redisReachable = RefreshSessionStore.isAvailable();
  });

  const fakeRes = () => {
    let status = 0;
    let body: any = null;
    const res = {
      status: (code: number) => {
        status = code;
        return { json: (data: any) => (body = data) };
      },
    } as unknown as Response;
    return { res, getStatus: () => status, getBody: () => body };
  };

  const refreshWith = async (token: string) => {
    const { res, getStatus, getBody } = fakeRes();
    await AuthController.refresh({ body: { refreshToken: token } } as unknown as Request, res);
    return { status: getStatus(), body: getBody() };
  };

  const mintTrackedSession = async (userId: string) => {
    const familyId = RefreshSessionStore.newFamilyId();
    const token = createRefreshToken({ userId, email: "chain@test.com", fam: familyId });
    const { jti } = verifyRefreshToken(token);
    await RefreshSessionStore.registerValid({ jti: jti as string, userId, familyId });
    return token;
  };

  it("A → B rotates successfully; reusing A afterward is rejected as reuse", async () => {
    if (!redisReachable) return;
    const tokenA = await mintTrackedSession("650000000000000000000201");

    const hop1 = await refreshWith(tokenA);
    expect(hop1.status).to.equal(200);
    expect(hop1.body.refreshToken).to.be.a("string");
    expect(hop1.body.refreshToken).to.not.equal(tokenA);

    const reuseA = await refreshWith(tokenA);
    expect(reuseA.status).to.equal(401);
    expect(reuseA.body).to.deep.equal({
      message: "Refresh token reuse detected. Please log in again.",
    });
  });

  it("A → B → C: reusing B (a middle-of-chain token, not the first) is also rejected, and the surviving C is revoked too", async () => {
    if (!redisReachable) return;
    const tokenA = await mintTrackedSession("650000000000000000000202");

    const hop1 = await refreshWith(tokenA); // A -> B
    expect(hop1.status).to.equal(200);
    const tokenB = hop1.body.refreshToken as string;

    const hop2 = await refreshWith(tokenB); // B -> C
    expect(hop2.status).to.equal(200);
    const tokenC = hop2.body.refreshToken as string;
    expect(tokenC).to.not.equal(tokenB);
    expect(tokenC).to.not.equal(tokenA);

    // Reuse B: B was already consumed by hop2, so this must be rejected —
    // detection isn't limited to only the very first token in a family.
    const reuseB = await refreshWith(tokenB);
    expect(reuseB.status).to.equal(401);
    expect(reuseB.body).to.deep.equal({
      message: "Refresh token reuse detected. Please log in again.",
    });

    // The reuse of B revokes the whole family, so even the legitimately-
    // issued, never-reused C must now be rejected too — a stolen mid-chain
    // token compromises every token in that lineage, not just itself.
    const tryC = await refreshWith(tokenC);
    expect(tryC.status).to.equal(401);
    expect(tryC.body).to.deep.equal({ message: "Session revoked. Please log in again." });
  });
});
