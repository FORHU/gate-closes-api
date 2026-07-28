import { ObjectId } from "mongodb";
import { MVerificationCode, TVerificationCode, TVerificationCodeUpdateOptions} from "../models/verification.code.model";
import { getDB } from "../utils/mongo";

export default class VerificationCodeRepo {
  static collection() {
    return getDB().collection("verification.code");
  }

  static async create(data: TVerificationCode) {
    return this.collection().insertOne(new MVerificationCode(data));
  }

  static async findByUserId(userId: string | ObjectId) {
    try {
      userId = new ObjectId(userId);
    } catch {
      return Promise.reject("Invalid user id.");
    }

    return this.collection().findOne({ userId });
  }

  static async findByUserIdAndPurpose(
    userId: string | ObjectId,
    purpose: "email_verify" | "reset_password"
  ) {
    try {
      userId = new ObjectId(userId);
    } catch {
      return Promise.reject("Invalid user id.");
    }

    return this.collection().findOne({ userId, purpose });
  }

  static async update(data: TVerificationCodeUpdateOptions) {
    try {
      data._id = new ObjectId(data._id);
    } catch {
      return Promise.reject("Invalid verification code id.");
    }

    const updatedAt = new Date();
    const setFields: Record<string, unknown> = { updatedAt };
    if (data.codeHash !== undefined) setFields.codeHash = data.codeHash;
    if (data.expiresAt !== undefined) setFields.expiresAt = data.expiresAt;
    if (data.resendAfter !== undefined) setFields.resendAfter = data.resendAfter;
    if (data.attempts !== undefined) setFields.attempts = data.attempts;
    if (data.purpose !== undefined) setFields.purpose = data.purpose;

    return this.collection().updateOne(
      { _id: data._id },
      { $set: setFields }
    );
  }

  static async delete(_id: string | ObjectId) {
    try {
      _id = new ObjectId(_id);
    } catch {
      return Promise.reject("Invalid verification code id.");
    }

    try {
      await this.collection().deleteOne({ _id });
      return Promise.resolve("Successfully deleted verification code.");
    } catch {
      return Promise.reject("Server internal error.");
    }
  }
}
