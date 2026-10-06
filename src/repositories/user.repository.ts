import { ObjectId } from "mongodb";
import { MUser, TUser, TUserUpdateOptions } from "../models/user.model";
import { getDB } from "../utils/mongo";
import { DEFAULT_ROLE } from "../domain/access/permissions";

export default class UserRepo {
  static collection() {
    return getDB().collection("user");
  }

  static async createForManualRegister(email: string) {
    const user: TUser = {
      email,
      signupStep: "email_verification",
      signupCompleted: false,
    };
    return this.collection().insertOne(new MUser(user));
  }

  static async create(user: TUser) {
    return this.collection().insertOne(new MUser(user));
  }

  static async findById(_id: string | ObjectId) {
    try {
      _id = new ObjectId(_id);
    } catch {
      return Promise.reject("Invalid user id.");
    }
    return this.collection().findOne({ _id });
  }

  static async findByEmail(email: string) {
    return this.collection().findOne({ email });
  }

  static async findByUsername(username: string) {
    return this.collection().findOne({ username });
  }

  static async update(user: TUserUpdateOptions) {
    try {
      user._id = new ObjectId(user._id);
    } catch {
      return Promise.reject("Invalid user id.");
    }

    const updatedAt = new Date();

    const setFields: Record<string, unknown> = { updatedAt };
    if (user.email !== undefined) setFields.email = user.email;
    if (user.username !== undefined) setFields.username = user.username;
    if (user.gender !== undefined) setFields.gender = user.gender;
    if (user.signupStep !== undefined) setFields.signupStep = user.signupStep;
    if (user.signupCompleted !== undefined) setFields.signupCompleted = user.signupCompleted;
    if (user.isCompleteProfile !== undefined) setFields.isCompleteProfile = user.isCompleteProfile;
    if (user.picture !== undefined) setFields.picture = user.picture;

    return this.collection().updateOne({ _id: user._id }, { $set: setFields });
  }

  /** Admin list: newest first, optional email/username prefix and role. */
  static async listForAdmin(filter: { q?: string; role?: string; limit?: number } = {}) {
    const match: Record<string, unknown> = {};
    if (filter.q) {
      const escaped = filter.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const prefix = new RegExp(`^${escaped}`, "i");
      match.$or = [{ email: prefix }, { username: prefix }];
    }
    if (filter.role) {
      // No field means "user".
      match.role = filter.role === DEFAULT_ROLE ? { $in: [null, DEFAULT_ROLE] } : filter.role;
    }
    return this.collection()
      .find(match, {
        projection: { email: 1, username: 1, picture: 1, role: 1, createdAt: 1 },
      })
      .sort({ createdAt: -1 })
      .limit(filter.limit ?? 50)
      .toArray();
  }

  /** "user" is stored as no field, so every existing user is a plain user. */
  static async setRole(_id: ObjectId, role: string) {
    const update =
      role === DEFAULT_ROLE
        ? { $unset: { role: "" }, $set: { updatedAt: new Date() } }
        : { $set: { role, updatedAt: new Date() } };
    return this.collection().updateOne({ _id }, update);
  }

  static async countWithRole(role: string) {
    return this.collection().countDocuments({ role });
  }
}
