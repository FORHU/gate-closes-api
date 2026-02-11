import { ObjectId } from "mongodb";
import { TUserAuth, TUserAuthUpdateOptions } from "../models/user.auth.model";
import UserAuthRepo from "../repositories/user.auth.repository";

export default class UserAuthSvc {

  static createForManualRegister(userId: string | ObjectId) {
    return UserAuthRepo.createForManualRegister(userId);
  }

  static createForGoogleRegister(userId: string | ObjectId, googleId: string) {
    return UserAuthRepo.createForGoogleRegister(userId, googleId);
  }

  static linkGoogleId(userId: string | ObjectId, googleId: string) {
    return UserAuthRepo.linkGoogleId(userId, googleId);
  }

  static create(auth: TUserAuth) {
    return UserAuthRepo.create(auth);
  }

  static findByUserId(userId: string | ObjectId) {
    return UserAuthRepo.findByUserId(userId);
  }

  static findByGoogleId(googleId: string) {
    return UserAuthRepo.findByGoogleId(googleId);
  }

  static verifyEmail(userId: string) {
    return UserAuthRepo.update({ userId, emailVerified: true });
  }

  static setPassword(userId: string, password: string) {
    return UserAuthRepo.update({ userId, password, hasPassword: true });
  }
}
