import { Request, Response, NextFunction } from "express";
import { TokenExpiredError } from "jsonwebtoken";
import { verifyAccessToken } from "../utils/jwt";
import { ALLOWED_ORIGINS } from "../config";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const sessionMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // 1. Credential Precedence:
  // Cookie present -> authenticate as cookie (and apply CSRF validation if mutating)
  // No cookie -> check Authorization Bearer header (no browser CSRF check)
  const cookieToken = req.cookies?.session_token;
  const authHeader = req.headers["authorization"];
  const bearerToken =
    authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : undefined;

  const isCookieAuth = Boolean(cookieToken);
  const token = cookieToken || bearerToken;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // 2. Cryptographic JWT Verification
  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      return res.status(401).json({ message: "Authorization token expired" });
    }
    return res.status(401).json({ message: "Invalid authorization token" });
  }

  // 3. Unified Server-Authoritative Identity
  req.user = payload;

  // 4. Primary CSRF Defense: Origin validation for cookie-authenticated mutating requests
  if (isCookieAuth && MUTATING_METHODS.has(req.method.toUpperCase())) {
    const origin = req.headers["origin"];
    if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
      return res.status(403).json({ message: "Forbidden: Invalid or missing Origin header" });
    }
  }

  return next();
};

export default sessionMiddleware;
