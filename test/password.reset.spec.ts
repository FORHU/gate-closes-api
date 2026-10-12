import { expect } from "chai";
import { describe, it, afterEach } from "mocha";
import bcrypt from "bcrypt";
import { ObjectId } from "mongodb";
import UserAuthSvc, { RESET_WINDOW_MS } from "../src/services/user.auth.service";
import UserSvc from "../src/services/user.service";
import UserRepo from "../src/repositories/user.repository";
import UserAuthRepo from "../src/repositories/user.auth.repository";
import VerificationCodeRepo from "../src/repositories/verification.code.repository";
import type { TVerificationCode } from "../src/models/verification.code.model";

describe("Password reset requires a verified code", () => {
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

  const userId = "650000000000000000000001";
  const codeId = new ObjectId();

  /** In-memory reset code record plus spies on password writes and deletes. */
  const setup = (record: Partial<TVerificationCode> | null) => {
    let stored: TVerificationCode | null = record
      ? ({
          _id: codeId,
          userId: new ObjectId(userId),
          codeHash: "",
          purpose: "reset_password",
          expiresAt: new Date(Date.now() + 60_000),
          resendAfter: new Date(),
          attempts: 0,
          ...record,
        } as TVerificationCode)
      : null;
    const calls = { passwordUpdates: 0, deletes: 0 };

    stub(UserRepo, "findById", async () => ({ _id: new ObjectId(userId), email: "a@b.c" }));
    stub(VerificationCodeRepo, "findByUserIdAndPurpose", async () => stored);
    stub(VerificationCodeRepo, "update", async (data: Partial<TVerificationCode>) => {
      stored = { ...stored!, ...data, _id: codeId } as TVerificationCode;
    });
    stub(VerificationCodeRepo, "delete", async () => {
      calls.deletes++;
      stored = null;
    });
    stub(UserAuthRepo, "update", async () => {
      calls.passwordUpdates++;
    });
    return { calls, current: () => stored };
  };

  it("refuses a reset when no code was ever requested", async () => {
    const { calls } = setup(null);
    let error: Error | undefined;
    try {
      await UserAuthSvc.resetPasswordForgot(userId, "NewPass1!");
    } catch (e) {
      error = e as Error;
    }
    expect(error?.message).to.equal("Verify the reset code first.");
    expect(calls.passwordUpdates).to.equal(0);
  });

  it("refuses a reset when the code was requested but not verified", async () => {
    const { calls } = setup({});
    let error: Error | undefined;
    try {
      await UserAuthSvc.resetPasswordForgot(userId, "NewPass1!");
    } catch (e) {
      error = e as Error;
    }
    expect(error?.message).to.equal("Verify the reset code first.");
    expect(calls.passwordUpdates).to.equal(0);
  });

  it("refuses a reset after the verified window has ended", async () => {
    const { calls } = setup({ verifiedAt: new Date(), expiresAt: new Date(Date.now() - 1) });
    let error: Error | undefined;
    try {
      await UserAuthSvc.resetPasswordForgot(userId, "NewPass1!");
    } catch (e) {
      error = e as Error;
    }
    expect(error?.message).to.equal("Verify the reset code first.");
    expect(calls.passwordUpdates).to.equal(0);
  });

  it("verifying the code opens the window; the reset uses the code up", async () => {
    const codeHash = await bcrypt.hash("1234", 4);
    const { calls, current } = setup({ codeHash });

    await UserAuthSvc.verifyResetCode(userId, "1234");
    const verified = current()!;
    expect(verified.verifiedAt).to.be.instanceOf(Date);
    expect(verified.expiresAt.getTime()).to.be.closeTo(Date.now() + RESET_WINDOW_MS, 5_000);

    await UserAuthSvc.resetPasswordForgot(userId, "NewPass1!");
    expect(calls.passwordUpdates).to.equal(1);
    expect(calls.deletes).to.equal(1);

    let error: Error | undefined;
    try {
      await UserAuthSvc.resetPasswordForgot(userId, "Another1!");
    } catch (e) {
      error = e as Error;
    }
    expect(error?.message).to.equal("Verify the reset code first.");
    expect(calls.passwordUpdates).to.equal(1);
  });

  it("a wrong code does not open the window", async () => {
    const codeHash = await bcrypt.hash("1234", 4);
    const { current } = setup({ codeHash });
    try {
      await UserAuthSvc.verifyResetCode(userId, "9999");
    } catch {
      // expected
    }
    expect(current()!.verifiedAt).to.equal(undefined);
  });
});

describe("set-username-gender is the last signup step only", () => {
  const originals: Array<() => void> = [];
  afterEach(() => {
    while (originals.length) originals.pop()!();
  });

  const stubUser = (user: Record<string, unknown>) => {
    const findById = UserRepo.findById;
    const update = UserRepo.update;
    let updates = 0;
    (UserRepo as unknown as Record<string, unknown>).findById = async () => user;
    (UserRepo as unknown as Record<string, unknown>).update = async () => {
      updates++;
    };
    originals.push(() => {
      UserRepo.findById = findById;
      UserRepo.update = update;
    });
    return () => updates;
  };

  const userId = "650000000000000000000002";

  it("sets them right after the password step", async () => {
    const updates = stubUser({ _id: userId, signupCompleted: true, isCompleteProfile: false });
    await UserSvc.setUsernameGender(userId, "Female", "traveler.one");
    expect(updates()).to.equal(1);
  });

  for (const [label, user] of [
    ["before the password is set", { signupCompleted: false, isCompleteProfile: false }],
    ["once the profile is complete", { signupCompleted: true, isCompleteProfile: true }],
  ] as const) {
    it(`refuses ${label}`, async () => {
      const updates = stubUser({ _id: userId, ...user });
      let error: Error | undefined;
      try {
        await UserSvc.setUsernameGender(userId, "Male", "someone.else");
      } catch (e) {
        error = e as Error;
      }
      expect(error?.message).to.match(/^Invalid step\./);
      expect(updates()).to.equal(0);
    });
  }
});
