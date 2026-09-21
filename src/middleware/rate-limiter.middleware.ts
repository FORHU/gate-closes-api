import rateLimit, { Options } from "express-rate-limit";
import { Request, Response } from "express";

const isTest = process.env.NODE_ENV === "test";

function createLimiter(customOptions: Partial<Options>) {
  return rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        message: "Too many requests from this IP, please try again later.",
      });
    },
    skip: () => isTest && process.env.ENABLE_RATE_LIMIT_TEST !== "true",
    ...customOptions,
  });
}

/**
 * Strict rate limiter for authentication endpoints (/api/user/auth/*)
 * e.g. OTP generation, OTP verification, login
 * 20 requests per 15-minute window per IP
 */
export const authRateLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    message: "Too many authentication attempts, please try again after 15 minutes.",
  },
});

/**
 * Rate limiter for Echo creation and replies
 * 30 requests per 5-minute window per IP
 */
export const echoCreationRateLimiter = createLimiter({
  windowMs: 5 * 60 * 1000,
  max: 30,
  message: {
    message: "You are posting echoes too quickly. Please wait a few minutes.",
  },
});

/**
 * General rate limiter for standard API endpoints
 * 300 requests per 15-minute window per IP
 */
export const generalRateLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 300,
});
