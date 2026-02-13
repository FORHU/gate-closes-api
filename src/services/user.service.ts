import UserRepo from "../repositories/user.repository";

export default class UserSvc {

  static async completeProfile(userId: string, gender: "Male" | "Female") {
    await UserRepo.update({ _id: userId, gender, isProfileCompleted: true });
    return UserRepo.findById(userId);
  }

}
