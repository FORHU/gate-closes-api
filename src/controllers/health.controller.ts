import { Request, Response } from "express";
import { getDB } from "../utils/mongo";
import RedisUtil from "../utils/redis.util";
import { RedisAdapterManager } from "../utils/redis.adapter";

export default class HealthController {
  /**
   * Liveness Probe: Quick check that process is running and accepting traffic
   */
  static getLiveness(req: Request, res: Response): void {
    res.status(200).json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Readiness Probe: Deep check verifying critical dependencies (MongoDB, Redis, Sockets)
   */
  static async getReadiness(req: Request, res: Response): Promise<void> {
    let mongoStatus: "up" | "down" = "down";
    try {
      const db = getDB();
      await db.command({ ping: 1 });
      mongoStatus = "up";
    } catch {
      mongoStatus = "down";
    }

    let redisStatus: "up" | "down" | "not_initialized" = "not_initialized";
    try {
      const redisClient = RedisUtil.useConnection();
      if (redisClient?.isOpen) {
        await redisClient.ping();
        redisStatus = "up";
      } else {
        redisStatus = "down";
      }
    } catch {
      redisStatus = "down";
    }

    const socketAdapter = RedisAdapterManager.isAdapterAttached() ? "redis" : "in-memory";

    const checks = {
      mongodb: mongoStatus,
      redis: redisStatus,
      socketAdapter,
    };

    // If database is down, service cannot serve requests reliably
    if (mongoStatus === "down") {
      res.status(503).json({
        status: "unhealthy",
        uptime: process.uptime(),
        checks,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.status(200).json({
      status: "ready",
      uptime: process.uptime(),
      checks,
      timestamp: new Date().toISOString(),
    });
  }
}
