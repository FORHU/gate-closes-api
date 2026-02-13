import { ObjectId } from "mongodb";
import { MUser, TUser, TUserUpdateOptions } from "../models/user.model";
import { getDB } from "../utils/mongo";

export default class UserRepo {
  static collection() {
    return getDB().collection("user");
  }

  static async createForManualRegister(email: string) {
    const user: TUser = { email, isProfileCompleted: false };
    return this.collection().insertOne(new MUser(user));
  }

  static async create(user: TUser) {
    return this.collection().insertOne(new MUser(user));
  }

  static async findById(_id: string | ObjectId) {
    try {
      _id = new ObjectId(_id);
    } catch (error) {
      return Promise.reject("Invalid user id.");
    }
    return this.collection().findOne({ _id });
  }

  static async findByEmail(email: string) {
    return this.collection().findOne({ email });
  }

  static async update(user: TUserUpdateOptions) {
    try {
      user._id = new ObjectId(user._id);
    } catch (error) {
      return Promise.reject("Invalid user id.");
    }

    const updatedAt = new Date();

    const setFields: any = { updatedAt };
    if (user.email !== undefined) setFields.email = user.email;
    if (user.gender !== undefined) setFields.gender = user.gender;
    if (user.isProfileCompleted !== undefined) setFields.isProfileCompleted = user.isProfileCompleted;

    return this.collection().updateOne({ _id: user._id },{ $set: setFields});
  }
}
