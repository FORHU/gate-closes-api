import { Request, Response, NextFunction } from "express";
import UserRepo from "../repositories/user.repository";
import RoleSvc from "../services/role.service";
import { roleNameOf, type Permission } from "../domain/access/permissions";

/**
 * After `sessionMiddleware`: lets through users whose role has every one of
 * [permissions]. The user's role is read from the database on each request
 * (not from the token) and the role's permissions from `RoleSvc` (cached
 * briefly), so changes apply right away.
 */
const requirePermission =
  (...permissions: Permission[]) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    let granted: readonly Permission[];
    try {
      granted = await RoleSvc.permissionsFor(roleNameOf(await UserRepo.findById(userId)));
    } catch {
      return res.status(403).json({ message: "Forbidden." });
    }
    if (!permissions.every((p) => granted.includes(p))) {
      return res.status(403).json({ message: "Forbidden." });
    }
    return next();
  };

export default requirePermission;
