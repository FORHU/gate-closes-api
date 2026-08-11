import UserRepo from "../repositories/user.repository";
import { TUserUpdateOptions } from "../models/user.model";

export default class UserSvc {
  /** Change username for authenticated user. Validates format and uniqueness. */
  static async changeUsername(userId: string, username: string) {
    const user = await UserRepo.findById(userId);
    if (!user) throw new Error("User not found.");

    const existing = await UserRepo.findByUsername(username);
    if (existing && String(existing._id) !== String(userId)) {
      throw new Error("Username is already taken.");
    }

    await UserRepo.update({ _id: userId, username });
    return UserRepo.findById(userId);
  }

  /** Change gender for authenticated user. */
  static async changeGender(userId: string, gender: "Male" | "Female") {
    const user = await UserRepo.findById(userId);
    if (!user) throw new Error("User not found.");

    await UserRepo.update({ _id: userId, gender });
    return UserRepo.findById(userId);
  }

  static async setUsernameGender(
    userId: string,
    gender: "Male" | "Female",
    username?: string
  ) {
    const user = await UserRepo.findById(userId);
    if (!user) throw new Error("User not found.");

    const updateData: TUserUpdateOptions = {
      _id: userId,
      gender,
      isCompleteProfile: true,
    };
    if (username !== undefined) {
      updateData.username = username;
    }
    await UserRepo.update(updateData);
    return UserRepo.findById(userId);
  }
}
