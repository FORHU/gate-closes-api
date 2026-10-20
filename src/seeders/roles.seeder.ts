import RoleSvc from "../services/role.service";
import { log } from "./helpers";

/**
 * System roles (user, user_premium, developer, admin, super_admin), from
 * SYSTEM_ROLES in src/domain/access/permissions.ts. Adds missing ones and
 * leaves edited ones alone; [reset] puts them back to their defaults.
 * Custom roles made in the admin are never touched.
 */
export async function seedRoles({ reset = false }: { reset?: boolean } = {}) {
  if (reset) {
    const names = await RoleSvc.resetSystemRoles();
    log(`roles reset to defaults: ${names.join(", ")}`);
    return;
  }
  const added = await RoleSvc.seedSystemRoles();
  log(`roles: ${added.length ? `added ${added.join(", ")}` : "all there, kept as they are"}`);
}
