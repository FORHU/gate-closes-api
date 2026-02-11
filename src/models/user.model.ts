import { ObjectId } from "mongodb";

export type TUser = {
  _id?: ObjectId;
  email: string;
  gender?: "Male" | "Female";
  isProfileCompleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TUserUpdateOptions = {
  _id?: ObjectId | string;
  email?: string;
  gender?: "Male" | "Female";
  isProfileCompleted?: boolean;
};

export class MUser implements Partial<TUser> {
  _id?: ObjectId;
  email: string;
  gender?: "Male" | "Female";
  isProfileCompleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;

  constructor({_id = new ObjectId(), email = "", gender, isProfileCompleted = false, createdAt = new Date(), updatedAt} = {} as TUser) {
    this._id = _id;
    this.email = email;
    this.gender = gender;
    this.isProfileCompleted = isProfileCompleted;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}