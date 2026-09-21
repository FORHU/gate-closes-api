import { Request, Response, NextFunction } from "express";
import { TokenExpiredError } from "jsonwebtoken";
import { verifyAccessToken } from "../utils/jwt";

const sessionMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authorization = req.headers["authorization"];
  const token = authorization && authorization.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      return res.status(401).json({ message: "Authorization token expired" });
    }
    return res.status(401).json({ message: "Invalid authorization token" });
  }
};

export default sessionMiddleware;
