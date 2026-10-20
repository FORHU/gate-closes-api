import { Request, Response } from "express";
import Joi from "joi";
import RoleSvc, { RoleConflictError, RoleNotFoundError } from "../services/role.service";
import {
  PERMISSIONS,
  PERMISSION_DESCRIPTIONS,
  ROLE_NAME_PATTERN,
  SUPER_ADMIN_ROLE,
} from "../domain/access/permissions";

const roleName = Joi.string()
  .trim()
  .lowercase()
  .pattern(ROLE_NAME_PATTERN)
  .message("Role name: lowercase letters, digits or _, 2 to 32, starting with a letter.");
const permissions = Joi.array()
  .items(Joi.string().valid(...PERMISSIONS))
  .unique();
const roleFields = {
  label: Joi.string().trim().min(1).max(60),
  description: Joi.string().trim().max(300).allow("", null),
  permissions,
};

function fail(res: Response, err: unknown) {
  if (err instanceof RoleNotFoundError) return res.status(404).json({ message: err.message });
  if (err instanceof RoleConflictError) return res.status(409).json({ message: err.message });
  const message = err instanceof Error ? err.message : "Server error.";
  return res.status(500).json({ message });
}

export default class AdminRoleCtrl {
  /** `GET /admin/permissions`: every permission with what it allows. */
  static async listPermissions(_req: Request, res: Response) {
    return res.json({
      data: PERMISSIONS.map((name) => ({ name, description: PERMISSION_DESCRIPTIONS[name] })),
    });
  }

  /** `GET /admin/roles`: system roles first; super admin shown with everything. */
  static async list(_req: Request, res: Response) {
    try {
      const roles = await RoleSvc.list();
      return res.json({
        data: roles.map((r) =>
          r.name === SUPER_ADMIN_ROLE ? { ...r, permissions: [...PERMISSIONS] } : r
        ),
      });
    } catch (err) {
      return fail(res, err);
    }
  }

  static async create(req: Request, res: Response) {
    const { error, value } = Joi.object({
      name: roleName.required(),
      ...roleFields,
      label: roleFields.label.required(),
      permissions: permissions.required(),
    }).validate(req.body);
    if (error) return res.status(400).json({ message: error.message });
    try {
      return res.status(201).json({ data: await RoleSvc.create(value) });
    } catch (err) {
      return fail(res, err);
    }
  }

  /** `PATCH /admin/roles/:name`: label, description, permissions. The name never changes. */
  static async update(req: Request, res: Response) {
    const { error, value } = Joi.object(roleFields).min(1).validate(req.body);
    if (error) return res.status(400).json({ message: error.message });
    try {
      return res.json({ data: await RoleSvc.update(req.params.name, value) });
    } catch (err) {
      return fail(res, err);
    }
  }

  static async remove(req: Request, res: Response) {
    try {
      await RoleSvc.remove(req.params.name);
      return res.status(204).end();
    } catch (err) {
      return fail(res, err);
    }
  }
}
