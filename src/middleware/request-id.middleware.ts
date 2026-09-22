import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import logger from "../utils/logger";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id?: string;
      startTime?: number;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.headers["x-request-id"];
  const requestId =
    typeof incomingId === "string" && incomingId.trim().length > 0
      ? incomingId.trim()
      : crypto.randomUUID();

  req.id = requestId;
  req.startTime = Date.now();
  res.setHeader("X-Request-Id", requestId);

  // Log on response completion
  res.on("finish", () => {
    const duration = req.startTime ? Date.now() - req.startTime : 0;
    const logLevel = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";

    logger.log(
      logLevel,
      `${req.method} ${req.originalUrl || req.url} ${res.statusCode} - ${duration}ms`,
      {
        requestId,
        method: req.method,
        url: req.originalUrl || req.url,
        statusCode: res.statusCode,
        durationMs: duration,
        ip: req.ip,
        userId: req.user?.userId || req.user?.id,
      }
    );
  });

  next();
}
