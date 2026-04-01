import { createClient, RedisClientType } from "redis";
import { REDIS_HOST, REDIS_PASSWORD, REDIS_PORT } from "../config";

export default class RedisUtil {
  static redisClient: RedisClientType;
  static async initialize() {
    this.redisClient = await createClient({
      password: REDIS_PASSWORD,
      socket: {
        host: REDIS_HOST,
        port: REDIS_PORT,
      },
    });

    this.redisClient.on("ready", () => {
      console.log(
        `[RedisUtil] Connected to Redis at ${REDIS_HOST}:${REDIS_PORT}`
      );
    });

    this.redisClient.on("error", (err) => {
      console.error("[RedisUtil] Redis connection error:", err);
    });

    await this.redisClient.connect();
  }

  static useConnection() {
    return this.redisClient;
  }

  static async getJson<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redisClient.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  static async setJson(
    key: string,
    value: unknown,
    opts?: { ttlSeconds?: number }
  ) {
    const ttlSeconds = opts?.ttlSeconds;
    const payload = JSON.stringify(value);
    if (ttlSeconds && ttlSeconds > 0) {
      return this.redisClient.set(key, payload, { EX: ttlSeconds });
    }
    return this.redisClient.set(key, payload);
  }

  static async del(key: string) {
    return this.redisClient.del(key);
  }
}
