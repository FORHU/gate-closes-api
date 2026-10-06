import { ObjectId } from "mongodb";
import { PERMISSIONS, ROLE_NAME_PATTERN, type Permission } from "../domain/access/permissions";

/** A role in the `role` collection; users point at it by `name`. */
export type TRole = {
  _id?: ObjectId;
  /** Unique slug, never changes (users store it). */
  name: string;
  label: string;
  description?: string | null;
  permissions: Permission[];
  /** Seeded at startup: can't be deleted. */
  isSystem: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

export class MRole implements TRole {
  _id: ObjectId;
  name: string;
  label: string;
  description: string | null;
  permissions: Permission[];
  isSystem: boolean;
  createdAt: Date;
  updatedAt?: Date;

  constructor({
    _id = new ObjectId(),
    name,
    label,
    description = null,
    permissions,
    isSystem,
    createdAt = new Date(),
    updatedAt,
  }: TRole) {
    this._id = _id;
    this.name = name;
    this.label = label;
    this.description = description;
    this.permissions = permissions;
    this.isSystem = isSystem;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

/**
 * MongoDB validator for `role`: shows in Atlas/Compass (Validation tab)
 * and makes the database refuse malformed roles. Applied by
 * `npm run db:schemas`; the permission list follows the code automatically.
 */
export const ROLE_JSON_SCHEMA = {
  bsonType: "object",
  title: "role",
  required: ["name", "label", "permissions", "isSystem"],
  properties: {
    _id: { bsonType: "objectId" },
    name: {
      bsonType: "string",
      pattern: ROLE_NAME_PATTERN.source,
      description: "Unique slug users point at, e.g. voucher_manager. Never changes.",
    },
    label: { bsonType: "string", minLength: 1, maxLength: 60 },
    description: { bsonType: ["string", "null"], maxLength: 300 },
    permissions: {
      bsonType: "array",
      uniqueItems: true,
      items: { enum: [...PERMISSIONS] },
      description: "Fixed list in src/domain/access/permissions.ts.",
    },
    isSystem: { bsonType: "bool", description: "Seeded role: can't be deleted." },
    createdAt: { bsonType: "date" },
    updatedAt: { bsonType: ["date", "null"] },
  },
};
