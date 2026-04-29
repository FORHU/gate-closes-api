import { ObjectId } from "mongodb";

export type SignupStep =
  | "email_verification"
  | "set_password"
  | "completed";

export type TUser = {
  _id?: ObjectId;
  email: string;
  username?: string;
  gender?: "Male" | "Female";
  signupStep?: SignupStep;
  signupCompleted?: boolean;
  isCompleteProfile?: boolean;
  picture?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TUserUpdateOptions = {
  _id?: ObjectId | string;
  email?: string;
  username?: string;
  gender?: "Male" | "Female";
  signupStep?: SignupStep;
  signupCompleted?: boolean;
  isCompleteProfile?: boolean;
  picture?: string;
};

export class MUser implements Partial<TUser> {
  _id?: ObjectId;
  email: string;
  username?: string;
  gender?: "Male" | "Female";
  signupStep?: SignupStep;
  signupCompleted?: boolean;
  isCompleteProfile?: boolean;
  picture?: string;
  createdAt?: Date;
  updatedAt?: Date;

  constructor({
    _id = new ObjectId(),
    email = "",
    username,
    gender,
    signupStep = "email_verification",
    signupCompleted = false,
    isCompleteProfile = false,
    picture,
    createdAt = new Date(),
    updatedAt,
  } = {} as TUser) {
    this._id = _id;
    this.email = email;
    this.username = username;
    this.gender = gender;
    this.signupStep = signupStep;
    this.signupCompleted = signupCompleted;
    this.isCompleteProfile = isCompleteProfile;
    this.picture = picture;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}