import UserRepo from "../repositories/user.repository";

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

  static async setUsernameGender(
    userId: string,
    gender: "Male" | "Female" | "Other",
    username?: string
  ) {
    const user = await UserRepo.findById(userId);
    if (!user) throw new Error("User not found.");

    const updateData: any = {
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
