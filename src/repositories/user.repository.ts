import { ObjectId } from "mongodb";
import { MUser, TUser, TUserUpdateOptions } from "../models/user.model";
import { getDB } from "../utils/mongo";
import { DEFAULT_ROLE } from "../domain/access/permissions";

/** Sort orders for the admin user list. `_noName` is added for username sorts. */
export const ADMIN_USER_SORTS = {
  newest: { createdAt: -1, _id: -1 },
  oldest: { createdAt: 1, _id: 1 },
  username_asc: { _noName: 1, username: 1, _id: 1 },
  username_desc: { _noName: 1, username: -1, _id: -1 },
} as const;
export type AdminUserSort = keyof typeof ADMIN_USER_SORTS;

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

  /**
   * Admin list, one page at a time, with optional email/username prefix and
   * role. The database filters, sorts, counts and skips, so only the
   * requested page leaves it. `_id` breaks ties so rows never repeat or go
   * missing between pages. Username sorts ignore case and always put users
   * without a username last.
   */
  static async listForAdmin(
    filter: {
      q?: string;
      role?: string;
      page?: number;
      limit?: number;
      sort?: AdminUserSort;
    } = {}
  ) {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 10;
    const sort = filter.sort ?? "newest";
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
    // ponytail: skip-based paging scans past skipped rows; switch to a
    // createdAt/_id cursor if the user list reaches the hundreds of thousands.
    const byName = sort === "username_asc" || sort === "username_desc";
    const [users, total] = await Promise.all([
      this.collection()
        .aggregate(
          [
            { $match: match },
            ...(byName
              ? [{ $addFields: { _noName: { $eq: [{ $ifNull: ["$username", ""] }, ""] } } }]
              : []),
            { $sort: ADMIN_USER_SORTS[sort] },
            { $skip: (page - 1) * limit },
            { $limit: limit },
            { $project: { email: 1, username: 1, picture: 1, role: 1, createdAt: 1 } },
          ],
          { collation: { locale: "en", strength: 2 } }
        )
        .toArray(),
      this.collection().countDocuments(match),
    ]);
    return { users, total };
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
