import { ObjectId } from "mongodb";

export type TUser = {
  _id?: ObjectId;
  email: string;
  username?: string;
  gender?: string;
  avatar?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TUserUpdateOptions = {
  _id?: ObjectId | string;
  email?: string;
  username?: string;
  gender?: string;
  avatar?: string;
};

export class MUser implements Partial<TUser> {
  _id?: ObjectId;
  email: string;
  username?: string;
  gender?: string;
  avatar?: string;
  createdAt?: Date;
  updatedAt?: Date;

  constructor({_id = new ObjectId(), email = "", username = "", gender, avatar = "", createdAt = new Date(), updatedAt} = {} as TUser) {
    this._id = _id;
    this.email = email;
    this.username = username;
    this.gender = gender;
    this.avatar = avatar;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}