import { ObjectId } from "mongodb";

export type TUserAuth = {
  _id?: ObjectId;
  userId: ObjectId;
  googleId?: string;
  provider?: string;
  password?: string;
  isVerified?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TUserAuthUpdateOptions = {
  _id?: ObjectId | string;
  userId: ObjectId | string;
  googleId?: string;
  provider?: string;
  password?: string;
  isVerified?: boolean;
};

export class MUserAuth implements Partial<TUserAuth> {
  _id?: ObjectId;
  userId: ObjectId;
  googleId?: string;
  provider?: string;
  password?: string;
  isVerified?: boolean;
  createdAt?: Date;
  updatedAt?: Date;

  constructor({ _id = new ObjectId(), userId, googleId, provider = "", password, isVerified = false, createdAt = new Date(), updatedAt } = {} as TUserAuth) {
    this._id = _id;
    this.userId = userId;
    this.googleId = googleId;
    this.provider = provider;
    this.password = password;
    this.isVerified = isVerified;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}