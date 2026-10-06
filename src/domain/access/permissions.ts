/**
 * Access control: permissions are fixed here (each one is checked by a
 * route, so a new one always comes with code); roles live in the `role`
 * collection and super admins edit them in the admin web app.
 *
 * A user has one role, by name; no `role` field means "user".
 */
export const PERMISSIONS = [
  "premium",
  "offers:read",
  "offers:write",
  "users:read",
  "users:role",
  "roles:manage",
  "airports:manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** Shown in the admin web app next to each permission. */
export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  premium: "Premium app features.",
  "offers:read": "See offers (ads, vouchers...) and their stats.",
  "offers:write": "Create, edit and delete offers.",
  "users:read": "List users and see their role.",
  "users:role": "Change a user's role.",
  "roles:manage": "Create, edit and delete roles.",
  "airports:manage": "Airport data maintenance: crawl, boundary sync.",
};

export const DEFAULT_ROLE = "user";
/** Always has every permission, whatever its stored list says. */
export const SUPER_ADMIN_ROLE = "super_admin";

/** Role names: lowercase slug, e.g. "voucher_manager". */
export const ROLE_NAME_PATTERN = /^[a-z][a-z0-9_]{1,31}$/;

export type SystemRoleSeed = {
  name: string;
  label: string;
  description: string;
  permissions: Permission[];
};

/**
 * Inserted at startup when missing; never overwritten, so edits made in
 * the admin web app stick. System roles can't be deleted.
 */
export const SYSTEM_ROLES: readonly SystemRoleSeed[] = [
  {
    name: DEFAULT_ROLE,
    label: "User",
    description: "Everyone who signs up.",
    permissions: [],
  },
  {
    name: "user_premium",
    label: "Premium user",
    description: "Users with premium features.",
    permissions: ["premium"],
  },
  {
    name: "developer",
    label: "Developer",
    description: "Engineers: airport data maintenance, read-only admin.",
    permissions: ["premium", "users:read", "offers:read", "airports:manage"],
  },
  {
    name: "admin",
    label: "Admin",
    description: "Runs offers (ads, vouchers) and sees users.",
    permissions: ["premium", "users:read", "offers:read", "offers:write"],
  },
  {
    name: SUPER_ADMIN_ROLE,
    label: "Super admin",
    description: "Everything, including roles and who has them.",
    permissions: [...PERMISSIONS],
  },
];

export function isPermission(value: unknown): value is Permission {
  return typeof value === "string" && (PERMISSIONS as readonly string[]).includes(value);
}

/** The user's stored role name, or "user" when none. */
export function roleNameOf(user: object | null | undefined): string {
  const role = (user as { role?: unknown } | null | undefined)?.role;
  return typeof role === "string" && role ? role : DEFAULT_ROLE;
}
