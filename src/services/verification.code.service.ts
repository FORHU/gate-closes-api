import { TVerificationCode, TVerificationCodeUpdateOptions} from "../models/verification.code.model";
import VerificationCodeRepo from "../repositories/verification.code.repository";
import { ObjectId } from "mongodb";

export default class VerificationCodeSvc {

  static create(data: TVerificationCode) {
    return VerificationCodeRepo.create(data);
  }

  static findByUserId(userId: string) {
    return VerificationCodeRepo.findByUserId(userId);
  }

  static findByUserIdAndPurpose( userId: string, purpose: "email_verify" | "reset_password") {
    return VerificationCodeRepo.findByUserIdAndPurpose(userId, purpose);
  }

  static update(data: TVerificationCodeUpdateOptions) {
    return VerificationCodeRepo.update(data);
  }

  static delete(_id: string | ObjectId) {
    return VerificationCodeRepo.delete(_id);
  }
}
