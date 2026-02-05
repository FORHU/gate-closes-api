import { ObjectId } from "mongodb";

export type TUser = {
  _id?: ObjectId;
  googleId?: string;
  email: string;
  name?: string;
  provider?: string;
  username?: string;
  avatar?: string;
  createdAt?: Date;
  gender?: string;
  updatedAt?: Date;
  password?: string;
};

export class MUser implements Partial<TUser> {
  _id?: ObjectId;
  googleId?: string;
  email: string;
  name?: string;
  provider?: string;
  username?: string;
  avatar?: string;
  createdAt?: Date;
  gender?: string;
  updatedAt?: Date;
  password?: string;

  constructor(
    {
      _id = new ObjectId(),
      googleId,
      email = "",
      name = "",
      provider = "",
      username = "",
      avatar = "",
      createdAt = new Date(),
      gender,
      updatedAt,
      password,
    } = {} as TUser,
  ) {
    this._id = _id;
    this.googleId = googleId;
    this.email = email;
    this.name = name;
    this.provider = provider;
    this.username = username;
    this.avatar = avatar;
    this.createdAt = createdAt;
    this.gender = gender;
    this.updatedAt = updatedAt;
    this.password = password;
  }
}

