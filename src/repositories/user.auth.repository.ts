import { ObjectId } from "mongodb";
import { MUserAuth, TUserAuth, TUserAuthUpdateOptions } from "../models/user.auth.model";
import { getDB } from "../utils/mongo";

export default class UserAuthRepo {
  static collection() {
    return getDB().collection("user.auth");
  }

  static async createForManualRegister(userId: string | ObjectId) {
    try {
      userId = new ObjectId(userId);
    } catch {
      return Promise.reject("Invalid user id.");
    }
    const auth: TUserAuth = { userId, provider: "local" };
    return this.collection().insertOne(new MUserAuth(auth));
  }

  static async create(auth: TUserAuth) {
    return this.collection().insertOne(new MUserAuth(auth));
  }

  static async findByUserId(userId: string | ObjectId) {
    try {
      userId = new ObjectId(userId);
    } catch {
      return Promise.reject("Invalid user id.");
    }
    return this.collection().findOne({ userId });
  }

  static async findByGoogleId(googleId: string) {
    return this.collection().findOne({ googleId });
  }

  static async createForGoogleRegister(userId: string | ObjectId, googleId: string) {
    try {
      userId = new ObjectId(userId);
    } catch {
      return Promise.reject("Invalid user id.");
    }
    const auth: TUserAuth = {
      userId,
      googleId,
      provider: "google",
    };
    return this.collection().insertOne(new MUserAuth(auth));
  }

  static async linkGoogleId(userId: string | ObjectId, googleId: string) {
    try {
      userId = new ObjectId(userId);
    } catch {
      return Promise.reject("Invalid user id.");
    }
    return this.update({ userId, googleId, provider: "google" });
  }

  static async update(auth: TUserAuthUpdateOptions) {
    try {
      if (auth.userId) auth.userId = new ObjectId(auth.userId);
    } catch {
      return Promise.reject("Invalid user id.");
    }
    
    const updatedAt = new Date();

    const setFields: Record<string, unknown> = { updatedAt };
    if (auth.password != null) setFields.password = auth.password;
    if (auth.provider != null) setFields.provider = auth.provider;
    if (auth.googleId != null) setFields.googleId = auth.googleId;
    
    return this.collection().updateOne(
      { userId: auth.userId },
      { $set: setFields }
    );
  }
}
