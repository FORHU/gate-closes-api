import { Request, Response } from "express";
import Joi from "joi";
import { ObjectId } from "mongodb";
import UserRepo from "../repositories/user.repository";
import RoleSvc from "../services/role.service";
import { ROLE_NAME_PATTERN, roleNameOf } from "../domain/access/permissions";

const roleName = Joi.string().pattern(ROLE_NAME_PATTERN).message("Invalid role name.");

export default class AdminUserCtrl {
  /** `GET /admin/users?q=&role=`: newest 50, by email/username prefix. */
  static async list(req: Request, res: Response) {
    const { error, value } = Joi.object({
      q: Joi.string().trim().max(100).allow(""),
      role: roleName,
      limit: Joi.number().integer().min(1).max(200).default(50),
    }).validate(req.query);
    if (error) return res.status(400).json({ message: error.message });
    try {
      const users = await UserRepo.listForAdmin(value);
      return res.json({ data: users.map((u) => ({ ...u, role: roleNameOf(u) })) });
    } catch {
      return res.status(500).json({ message: "Server error." });
    }
  }

  /**
   * `PATCH /admin/users/:id/role` with `{role}`: any existing role. Nobody
   * changes their own role, so the last super admin can't lock everyone out.
   */
  static async setRole(req: Request, res: Response) {
    const { error, value } = Joi.object({
      id: Joi.string().hex().length(24).required(),
      role: roleName.required(),
    }).validate({ id: req.params.id, role: req.body?.role });
    if (error) return res.status(400).json({ message: error.message });

    if (value.id === req.user?.userId) {
      return res.status(409).json({ message: "You can't change your own role." });
    }
    try {
      if (!(await RoleSvc.exists(value.role))) {
        return res.status(400).json({ message: `No role named "${value.role}".` });
      }
      const result = await UserRepo.setRole(new ObjectId(value.id), value.role);
      if (result.matchedCount === 0) {
        return res.status(404).json({ message: "User not found." });
      }
      return res.json({ data: { id: value.id, role: value.role } });
    } catch {
      return res.status(500).json({ message: "Server error." });
    }
  }
}
