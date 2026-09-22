import { expect } from "chai";
import { describe, it, afterEach } from "mocha";
import RefreshSessionStore from "../src/utils/refresh.session.store";
import RedisUtil from "../src/utils/redis.util";

/**
 * MERGE_HARDENING_PLAN.md Blocker 2 — unit coverage for the reuse-
 * detection store itself, isolated from Redis via stubs (same style as
 * airport.repository.spec.ts) so these assertions don't depend on a
 * real Redis connection being up in whatever environment runs them.
 */
describe("RefreshSessionStore", () => {
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

  const useAvailableRedis = () => {
    stub(RedisUtil, "useConnection", () => ({ isOpen: true }));
  };

  const useUnavailableRedis = () => {
    stub(RedisUtil, "useConnection", () => ({ isOpen: false }));
  };

  describe("isAvailable", () => {
    it("is true when the Redis client is open", () => {
      useAvailableRedis();
      expect(RefreshSessionStore.isAvailable()).to.equal(true);
    });

    it("is false when the Redis client is closed or missing", () => {
      useUnavailableRedis();
      expect(RefreshSessionStore.isAvailable()).to.equal(false);
    });
  });

  describe("fail-open behavior when Redis is unavailable", () => {
    it("registerValid, markRotated, and revokeFamily are silent no-ops", async () => {
      useUnavailableRedis();
      let setJsonCalled = false;
      stub(RedisUtil, "setJson", async () => {
        setJsonCalled = true;
      });

      await RefreshSessionStore.registerValid({ jti: "a", userId: "u1", familyId: "f1" });
      await RefreshSessionStore.markRotated("a", { userId: "u1", familyId: "f1", status: "valid" });
      await RefreshSessionStore.revokeFamily("f1");

      expect(setJsonCalled).to.equal(false);
    });

    it("getToken returns null and isFamilyRevoked returns false, without touching Redis", async () => {
      useUnavailableRedis();
      let getJsonCalled = false;
      stub(RedisUtil, "getJson", async () => {
        getJsonCalled = true;
        return null;
      });

      expect(await RefreshSessionStore.getToken("a")).to.equal(null);
      expect(await RefreshSessionStore.isFamilyRevoked("f1")).to.equal(false);
      expect(getJsonCalled).to.equal(false);
    });
  });

  describe("when Redis is available", () => {
    it("registerValid stores a valid record keyed by jti with a TTL", async () => {
      useAvailableRedis();
      let capturedKey: string | null = null;
      let capturedValue: unknown = null;
      let capturedOpts: unknown = null;
      stub(RedisUtil, "setJson", async (key: string, value: unknown, opts: unknown) => {
        capturedKey = key;
        capturedValue = value;
        capturedOpts = opts;
      });

      await RefreshSessionStore.registerValid({ jti: "jti-1", userId: "u1", familyId: "fam-1" });

      expect(capturedKey).to.equal("refresh:jti:jti-1");
      expect(capturedValue).to.deep.equal({ userId: "u1", familyId: "fam-1", status: "valid" });
      expect((capturedOpts as { ttlSeconds: number }).ttlSeconds).to.be.a("number");
      expect((capturedOpts as { ttlSeconds: number }).ttlSeconds).to.be.greaterThan(0);
    });

    it("markRotated flips status to rotated while preserving userId/familyId", async () => {
      useAvailableRedis();
      let capturedValue: unknown = null;
      stub(RedisUtil, "setJson", async (_key: string, value: unknown) => {
        capturedValue = value;
      });

      await RefreshSessionStore.markRotated("jti-1", {
        userId: "u1",
        familyId: "fam-1",
        status: "valid",
      });

      expect(capturedValue).to.deep.equal({ userId: "u1", familyId: "fam-1", status: "rotated" });
    });

    it("getToken round-trips whatever RedisUtil.getJson returns", async () => {
      useAvailableRedis();
      stub(RedisUtil, "getJson", async (key: string) => {
        expect(key).to.equal("refresh:jti:jti-1");
        return { userId: "u1", familyId: "fam-1", status: "rotated" };
      });

      const result = await RefreshSessionStore.getToken("jti-1");
      expect(result).to.deep.equal({ userId: "u1", familyId: "fam-1", status: "rotated" });
    });

    it("isFamilyRevoked reflects whatever the revoked-flag key holds", async () => {
      useAvailableRedis();
      stub(RedisUtil, "getJson", async (key: string) => {
        expect(key).to.equal("refresh:family:revoked:fam-1");
        return { revoked: true };
      });

      expect(await RefreshSessionStore.isFamilyRevoked("fam-1")).to.equal(true);
    });

    it("revokeFamily writes a revoked flag for the family with a TTL", async () => {
      useAvailableRedis();
      let capturedKey: string | null = null;
      let capturedValue: unknown = null;
      stub(RedisUtil, "setJson", async (key: string, value: unknown) => {
        capturedKey = key;
        capturedValue = value;
      });

      await RefreshSessionStore.revokeFamily("fam-1");

      expect(capturedKey).to.equal("refresh:family:revoked:fam-1");
      expect(capturedValue).to.deep.equal({ revoked: true });
    });
  });

  describe("newFamilyId", () => {
    it("generates distinct ids on each call", () => {
      const a = RefreshSessionStore.newFamilyId();
      const b = RefreshSessionStore.newFamilyId();
      expect(a).to.be.a("string");
      expect(a).to.not.equal(b);
    });
  });
});
