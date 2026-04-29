import UserRepo from "../repositories/user.repository";

export default class UserSvc {
  static async updateProfile(userId: string, username?: string, picture?: string) {
    const user = await UserRepo.findById(userId);
    if (!user) throw new Error("User not found.");

    const updateData: any = { _id: userId };

    if (username) {
      const existing = await UserRepo.findByUsername(username);
      if (existing && String(existing._id) !== String(userId)) {
        throw new Error("Username is already taken.");
      }
      updateData.username = username;
    }

    if (picture !== undefined) {
      updateData.picture = picture;
    }

    await UserRepo.update(updateData);
    return UserRepo.findById(userId);
  }

  /** Change username for authenticated user. Validates format and uniqueness. */
  static async changeUsername(userId: string, username: string) {
    return this.updateProfile(userId, username);
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
