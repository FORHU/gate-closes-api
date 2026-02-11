import { ObjectId } from "mongodb";
import { TUser, TUserUpdateOptions } from "../models/user.model";
import UserRepo from "../repositories/user.repository";

export default class UserSvc {

  static createForManualRegister(email: string) {
    return UserRepo.createForManualRegister(email);
  }

  static create(user: TUser) {
    return UserRepo.create(user);
  }

  static findById(_id: string | ObjectId) {
    return UserRepo.findById(_id);
  }

  static findByEmail(email: string) {
    return UserRepo.findByEmail(email);
  }

  static update(user: TUserUpdateOptions) {
    return UserRepo.update(user);
  }
}
