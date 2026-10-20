import { MRole, TRole } from "../models/role.model";
import type { Permission } from "../domain/access/permissions";
import { getDB } from "../utils/mongo";

export default class RoleRepo {
  static collection() {
    return getDB().collection<TRole>("role");
  }

  static async list() {
    return this.collection().find({}).sort({ isSystem: -1, name: 1 }).toArray();
  }

  static async findByName(name: string) {
    return this.collection().findOne({ name });
  }

  static async create(role: TRole) {
    const doc = new MRole(role);
    await this.collection().insertOne(doc);
    return doc;
  }

  /** Inserts the role only if no role has that name (keeps admin edits). */
  static async insertIfAbsent(role: TRole) {
    const doc = new MRole(role);
    const { _id, ...fields } = doc;
    const result = await this.collection().updateOne(
      { name: role.name },
      { $setOnInsert: { _id, ...fields } },
      { upsert: true }
    );
    return result.upsertedCount === 1;
  }

  /** Puts a system role back to its defaults (label, description, permissions). */
  static async resetSystem(role: TRole) {
    const { _id, createdAt, ...defaults } = new MRole(role);
    await this.collection().updateOne(
      { name: role.name },
      { $set: { ...defaults, updatedAt: new Date() }, $setOnInsert: { _id, createdAt } },
      { upsert: true }
    );
  }

  static async update(
    name: string,
    fields: Partial<{ label: string; description: string | null; permissions: Permission[] }>
  ) {
    return this.collection().findOneAndUpdate(
      { name },
      { $set: { ...fields, updatedAt: new Date() } },
      { returnDocument: "after" }
    );
  }

  static async delete(name: string) {
    const result = await this.collection().deleteOne({ name, isSystem: false });
    return result.deletedCount === 1;
  }
}
