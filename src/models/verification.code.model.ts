import { ObjectId } from "mongodb";

export type TVerificationCode = {
  _id?: ObjectId;
  userId: ObjectId;
  codeHash: string;
  purpose: "email_verify" | "reset_password";
  expiresAt: Date;
  resendAfter: Date;
  attempts?: number;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TVerificationCodeUpdateOptions = {
  _id?: ObjectId | string;
  userId?: ObjectId | string;
  codeHash?: string;
  purpose?: "email_verify" | "reset_password";
  expiresAt?: Date;
  resendAfter?: Date;
  attempts?: number;
};

export class MVerificationCode implements Partial<TVerificationCode> {
  _id?: ObjectId;
  userId: ObjectId;
  codeHash: string;
  purpose: "email_verify" | "reset_password";
  expiresAt: Date;
  resendAfter: Date;
  attempts?: number;
  createdAt?: Date;
  updatedAt?: Date;

  constructor({ _id = new ObjectId(), userId, codeHash = "", purpose = "email_verify", expiresAt = new Date(), resendAfter = new Date(), attempts = 0, createdAt = new Date(), updatedAt } = {} as TVerificationCode) {
    this._id = _id;
    this.userId = userId!;
    this.codeHash = codeHash;
    this.purpose = purpose;
    this.expiresAt = expiresAt;
    this.resendAfter = resendAfter;
    this.attempts = attempts;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}
