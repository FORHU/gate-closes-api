import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient, RedisClientType } from "redis";
import { REDIS_HOST, REDIS_PASSWORD, REDIS_PORT, isDev } from "../config";

export class RedisAdapterManager {
  private static pubClient: RedisClientType | null = null;
  private static subClient: RedisClientType | null = null;

  static async initAdapter(io: Server): Promise<boolean> {
    if (!REDIS_HOST) {
      console.log(
        "[RedisAdapter] REDIS_HOST not configured, using default in-memory adapter"
      );
      return false;
    }

    try {
      const clientConfig = {
        password: REDIS_PASSWORD || undefined,
        socket: {
          host: REDIS_HOST,
          port: REDIS_PORT || 6379,
          connectTimeout: 3000,
          reconnectStrategy: (retries: number) => {
            if (retries > 3 && isDev) return false;
            return Math.min(retries * 100, 3000);
          },
        },
      };

      this.pubClient = createClient(clientConfig) as RedisClientType;
      this.subClient = this.pubClient.duplicate() as RedisClientType;

      this.pubClient.on("error", (err) => {
        console.warn("[RedisAdapter] Pub client error:", err.message || err);
      });
      this.subClient.on("error", (err) => {
        console.warn("[RedisAdapter] Sub client error:", err.message || err);
      });

      await Promise.all([this.pubClient.connect(), this.subClient.connect()]);

      io.adapter(createAdapter(this.pubClient, this.subClient));
      console.log(
        `[RedisAdapter] Successfully attached Redis pub/sub adapter (${REDIS_HOST}:${REDIS_PORT || 6379})`
      );
      return true;
    } catch (err) {
      console.warn(
        "[RedisAdapter] Unable to connect to Redis for socket clustering; falling back to in-memory adapter:",
        (err as Error).message || err
      );
      return false;
    }
  }

  static getClients() {
    return {
      pubClient: this.pubClient,
      subClient: this.subClient,
    };
  }

  static async close(): Promise<void> {
    const promises: Promise<unknown>[] = [];
    if (this.pubClient?.isOpen) {
      promises.push(this.pubClient.quit());
    }
    if (this.subClient?.isOpen) {
      promises.push(this.subClient.quit());
    }
    await Promise.allSettled(promises);
    this.pubClient = null;
    this.subClient = null;
  }
}
