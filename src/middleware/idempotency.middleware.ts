import { Request, Response, NextFunction } from "express";
import RedisUtil from "../utils/redis.util";
import logger from "../utils/logger";

const IDEMPOTENCY_TTL_SECONDS = 300; // 5 minutes
const IN_FLIGHT_LOCK_TTL_SECONDS = 30; // 30 seconds

interface CachedResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: any;
}

/**
 * Idempotency middleware (§28).
 * Ensures safe retries for state-changing operations (Echo creation, message sending, conversations).
 * Looks for `Idempotency-Key` or `X-Idempotency-Key` header.
 */
export function idempotencyMiddleware(req: Request, res: Response, next: NextFunction): void {
  const rawKey = req.headers["idempotency-key"] || req.headers["x-idempotency-key"];

  if (!rawKey || typeof rawKey !== "string" || rawKey.trim().length === 0) {
    return next();
  }

  const idempotencyKey = rawKey.trim();
  const userId = req.user?.userId || req.user?.id || req.ip || "anon";
  const redisKey = `idempotency:${userId}:${idempotencyKey}`;

  void (async () => {
    try {
      const client = RedisUtil.useConnection();
      if (!client?.isOpen) {
        // If Redis is offline, continue without idempotency caching rather than failing requests
        return next();
      }

      const cached = await RedisUtil.getJson<CachedResponse | { inFlight: boolean }>(redisKey);

      if (cached) {
        if ("inFlight" in cached && cached.inFlight) {
          res.status(409).json({
            message: "A request with this idempotency key is currently being processed. Please retry shortly.",
          });
          return;
        }

        const cachedRes = cached as CachedResponse;
        res.setHeader("X-Cache-Lookup", "HIT-IDEMPOTENT");
        res.status(cachedRes.statusCode).json(cachedRes.body);
        return;
      }

      // Mark as in-flight
      await RedisUtil.setJson(redisKey, { inFlight: true }, { ttlSeconds: IN_FLIGHT_LOCK_TTL_SECONDS });

      // Intercept res.json to cache on success
      const originalJson = res.json.bind(res);
      res.json = (body: any): Response => {
        // Only cache successful 2xx responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          void RedisUtil.setJson(
            redisKey,
            {
              statusCode: res.statusCode,
              body,
            },
            { ttlSeconds: IDEMPOTENCY_TTL_SECONDS }
          ).catch((err) => {
            logger.warn(`[Idempotency] Failed to cache response for ${redisKey}:`, err);
          });
        } else {
          // If request failed, remove lock so the client can retry cleanly
          void RedisUtil.del(redisKey).catch(() => {});
        }

        return originalJson(body);
      };

      next();
    } catch (err) {
      logger.warn(`[Idempotency] Error processing key ${redisKey}:`, err);
      next();
    }
  })();
}
