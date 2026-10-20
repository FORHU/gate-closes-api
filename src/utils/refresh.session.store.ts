/**
 * Refresh-token reuse detection (MERGE_HARDENING_PLAN.md Blocker 2).
 *
 * Rotation alone (issuing a new refresh token on every /refresh call)
 * does not prevent replay: without this store, a captured refresh
 * token stays valid until its own 7-day expiry even after it has been
 * "rotated away". This store tracks each refresh token's jti against
 * the session family it belongs to, so a token that gets used a
 * SECOND time (after it was already rotated once) is recognizable as
 * reuse — at which point the whole family is revoked, not just the
 * one request rejected.
 *
 * Fail-open by design, matching idempotencyMiddleware's precedent in
 * this codebase: if Redis is unreachable, rotation still works (no
 * request-blocking dependency on Redis for login/refresh), it just
 * temporarily loses reuse detection. Production readiness already
 * reports Redis outages via /readiness — this store doesn't duplicate
 * that as a hard failure here too.
 */

import crypto from "crypto";
import RedisUtil from "./redis.util";
import { REFRESH_TOKEN_EXPIRY } from "../config";
import logger from "./logger";

export type SessionStatus = "valid" | "rotated";

export interface SessionRecord {
  userId: string;
  familyId: string;
  status: SessionStatus;
}

const JTI_PREFIX = "refresh:jti:";
const FAMILY_REVOKED_PREFIX = "refresh:family:revoked:";

function refreshTtlSeconds(): number {
  const raw = (REFRESH_TOKEN_EXPIRY || "7d").trim();
  const match = raw.match(/^(\d+)\s*([smhd])?$/i);
  if (!match) return 7 * 24 * 60 * 60;
  const value = Number(match[1]);
  const unit = (match[2] || "s").toLowerCase();
  const multiplier: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return value * (multiplier[unit] ?? 1);
}

export default class RefreshSessionStore {
  static isAvailable(): boolean {
    try {
      const client = RedisUtil.useConnection();
      return Boolean(client?.isOpen);
    } catch {
      return false;
    }
  }

  static newFamilyId(): string {
    return crypto.randomUUID();
  }

  /** Registers a refresh token's jti as the currently-valid token for its family. */
  static async registerValid(params: {
    jti: string;
    userId: string;
    familyId: string;
  }): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      const record: SessionRecord = {
        userId: params.userId,
        familyId: params.familyId,
        status: "valid",
      };
      await RedisUtil.setJson(`${JTI_PREFIX}${params.jti}`, record, {
        ttlSeconds: refreshTtlSeconds(),
      });
    } catch (err) {
      logger.warn(`[RefreshSessionStore] Failed to register jti ${params.jti}:`, err);
    }
  }

  static async getToken(jti: string): Promise<SessionRecord | null> {
    if (!this.isAvailable()) return null;
    try {
      return await RedisUtil.getJson<SessionRecord>(`${JTI_PREFIX}${jti}`);
    } catch {
      return null;
    }
  }

  /** Marks a token as consumed by rotation — presenting it again after this is reuse. */
  static async markRotated(jti: string, record: SessionRecord): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await RedisUtil.setJson(
        `${JTI_PREFIX}${jti}`,
        { ...record, status: "rotated" } as SessionRecord,
        { ttlSeconds: refreshTtlSeconds() }
      );
    } catch (err) {
      logger.warn(`[RefreshSessionStore] Failed to mark jti ${jti} rotated:`, err);
    }
  }

  static async isFamilyRevoked(familyId: string): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const revoked = await RedisUtil.getJson<{ revoked: true }>(
        `${FAMILY_REVOKED_PREFIX}${familyId}`
      );
      return Boolean(revoked);
    } catch {
      return false;
    }
  }

  /** Revokes every token in a session family — called on detected reuse, and on logout. */
  static async revokeFamily(familyId: string): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await RedisUtil.setJson(
        `${FAMILY_REVOKED_PREFIX}${familyId}`,
        { revoked: true },
        { ttlSeconds: refreshTtlSeconds() }
      );
    } catch (err) {
      logger.warn(`[RefreshSessionStore] Failed to revoke family ${familyId}:`, err);
    }
  }
}
