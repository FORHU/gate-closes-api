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

  /** Edit profile fields (username and/or gender) for authenticated user. Only fields present in `fields` are updated. */
  static async editProfile(
    userId: string,
    fields: { username?: string; gender?: "Male" | "Female" }
  ) {
    const user = await UserRepo.findById(userId);
    if (!user) throw new Error("User not found.");

    if (fields.username !== undefined) {
      const existing = await UserRepo.findByUsername(fields.username);
      if (existing && String(existing._id) !== String(userId)) {
        throw new Error("Username is already taken.");
      }
    }

    const updateData: TUserUpdateOptions = { _id: userId };
    if (fields.username !== undefined) updateData.username = fields.username;
    if (fields.gender !== undefined) updateData.gender = fields.gender;

    await UserRepo.update(updateData);
    return UserRepo.findById(userId);
  }

  static async setUsernameGender(userId: string, gender: "Male" | "Female", username?: string) {
    const user = await UserRepo.findById(userId);
    if (!user) throw new Error("User not found.");
    // Last signup step only (the route has no session): after the password
    // is set and before the profile is complete. Later changes go through
    // the authenticated edit-profile route.
    if (!user.signupCompleted || user.isCompleteProfile) {
      throw new Error("Invalid step. Username and gender are set at the end of signup.");
    }

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
