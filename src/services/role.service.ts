import RoleRepo from "../repositories/role.repository";
import UserRepo from "../repositories/user.repository";
import {
  DEFAULT_ROLE,
  PERMISSIONS,
  SUPER_ADMIN_ROLE,
  SYSTEM_ROLES,
  type Permission,
} from "../domain/access/permissions";

export class RoleNotFoundError extends Error {
  constructor() {
    super("Role not found.");
    this.name = "RoleNotFoundError";
  }
}

/** A role change refused: taken name, system role, role still in use... */
export class RoleConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoleConflictError";
  }
}

/**
 * Permissions per role name, kept briefly so a permission check doesn't
 * read the role on every request. Cleared on every role change here; other
 * API instances catch up within [CACHE_MS].
 */
const CACHE_MS = 30_000;
const cache = new Map<string, { permissions: readonly Permission[]; at: number }>();

export default class RoleSvc {
  static clearCache() {
    cache.clear();
  }

  /**
   * What a role may do. Super admin is always everything; an unknown or
   * deleted role falls back to "user", so a stale name never grants more.
   */
  static async permissionsFor(name: string): Promise<readonly Permission[]> {
    if (name === SUPER_ADMIN_ROLE) return PERMISSIONS;
    const hit = cache.get(name);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.permissions;

    const role = await RoleRepo.findByName(name);
    if (!role && name !== DEFAULT_ROLE) return this.permissionsFor(DEFAULT_ROLE);
    const permissions = role?.permissions ?? [];
    cache.set(name, { permissions, at: Date.now() });
    return permissions;
  }

  static async can(name: string, permission: Permission) {
    return (await this.permissionsFor(name)).includes(permission);
  }

  /** Seeder: adds missing system roles; leaves edited ones alone. */
  static async seedSystemRoles() {
    const added: string[] = [];
    for (const seed of SYSTEM_ROLES) {
      if (await RoleRepo.insertIfAbsent({ ...seed, isSystem: true })) added.push(seed.name);
    }
    this.clearCache();
    return added;
  }

  /** Seeder `--reset`: every system role back to its defaults; custom roles untouched. */
  static async resetSystemRoles() {
    for (const seed of SYSTEM_ROLES) {
      await RoleRepo.resetSystem({ ...seed, isSystem: true, updatedAt: undefined });
    }
    this.clearCache();
    return SYSTEM_ROLES.map((r) => r.name);
  }

  static async list() {
    return RoleRepo.list();
  }

  static async exists(name: string) {
    return name === DEFAULT_ROLE || Boolean(await RoleRepo.findByName(name));
  }

  static async create(fields: {
    name: string;
    label: string;
    description?: string | null;
    permissions: Permission[];
  }) {
    if (await RoleRepo.findByName(fields.name)) {
      throw new RoleConflictError(`A role named "${fields.name}" already exists.`);
    }
    const role = await RoleRepo.create({ ...fields, isSystem: false });
    this.clearCache();
    return role;
  }

  static async update(
    name: string,
    fields: Partial<{ label: string; description: string | null; permissions: Permission[] }>
  ) {
    if (name === SUPER_ADMIN_ROLE && fields.permissions) {
      throw new RoleConflictError("Super admin always has every permission.");
    }
    const role = await RoleRepo.update(name, fields);
    if (!role) throw new RoleNotFoundError();
    this.clearCache();
    return role;
  }

  static async remove(name: string) {
    const role = await RoleRepo.findByName(name);
    if (!role) throw new RoleNotFoundError();
    if (role.isSystem) throw new RoleConflictError("System roles can't be deleted.");
    const users = await UserRepo.countWithRole(name);
    if (users > 0) {
      throw new RoleConflictError(
        `${users} user${users === 1 ? " has" : "s have"} this role. Move them to another role first.`
      );
    }
    await RoleRepo.delete(name);
    this.clearCache();
  }
}
