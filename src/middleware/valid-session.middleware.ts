import { Request, Response, NextFunction } from "express";
import { SECRET_KEY } from "../config";
import { verifyAccessToken } from "../utils/jwt";

const sessionMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const scopedAuth = req.headers["scoped-auth"];
  if (scopedAuth && scopedAuth === SECRET_KEY) return next();

  const authorization = req.headers["authorization"];
  const token = authorization && authorization.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ message: "Authorization token expired" });
  }
};

export default sessionMiddleware;
