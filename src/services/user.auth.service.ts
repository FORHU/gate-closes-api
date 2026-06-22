import bcrypt from "bcrypt";
import { ObjectId } from "mongodb";
import { OAuth2Client } from "google-auth-library";
import UserAuthRepo from "../repositories/user.auth.repository";
import UserRepo from "../repositories/user.repository";
import VerificationCodeRepo from "../repositories/verification.code.repository";
import { sendOtpEmail } from "./send.otp.service";
import { sendOtpResetEmail } from "./send.otp.forgot"; //ggs
import { createAccessToken, createRefreshToken } from "../utils/jwt";
import { GOOGLE_CLIENT_ID } from "../config";

const googleClient = new OAuth2Client();

export default class UserAuthSvc {

  static async registerEmailAndSendOtp(email: string) {
    const user = await UserRepo.findByEmail(email);
    let userId: string;

    if (user) {
      if (user.signupCompleted) {
        throw new Error("Email already registered.");
      }
      userId = String(user._id);

      if (user.signupStep === "set_password") {
        return { userId, signupStep: "set_password" as const };
      }

      const existingCode = await VerificationCodeRepo.findByUserIdAndPurpose(userId, "email_verify");
      if (existingCode) await VerificationCodeRepo.delete(existingCode._id!);
    } else {
      const userResult = await UserRepo.createForManualRegister(email);
      await UserAuthRepo.createForManualRegister(userResult.insertedId);
      userId = String(userResult.insertedId);
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const codeHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 1 * 60 * 1000);
    const resendAfter = new Date(Date.now() + 60 * 1000);

    await VerificationCodeRepo.create({
      userId: new ObjectId(userId),
      codeHash,
      purpose: "email_verify",
      expiresAt,
      resendAfter,
      attempts: 0,
    });

    await sendOtpEmail(email, otp);

    return { userId, signupStep: "email_verification" as const };
  }

  static async verifyEmailWithCode(userId: string, code: string) {
    const user = await UserRepo.findById(userId);
    if (!user) throw new Error("User not found.");

    const verificationRecord = await VerificationCodeRepo.findByUserIdAndPurpose(
      userId,
      "email_verify"
    );

    if (!verificationRecord) {
      throw new Error("No verification code found.");
    }

    if (new Date() > verificationRecord.expiresAt) {
      await VerificationCodeRepo.delete(verificationRecord._id);
      throw new Error("Verification code expired.");
    }

    if ((verificationRecord.attempts ?? 0) >= 5) {
      await VerificationCodeRepo.delete(verificationRecord._id);
      throw new Error("Too many failed attempts. Request a new code.");
    }

    const isCodeValid = await bcrypt.compare(code, verificationRecord.codeHash);
    if (!isCodeValid) {
      await VerificationCodeRepo.update({
        _id: verificationRecord._id,
        attempts: (verificationRecord.attempts ?? 0) + 1,
      });
      throw new Error("Invalid verification code.");
    }

    await UserRepo.update({ _id: userId, signupStep: "set_password" });
    await VerificationCodeRepo.delete(verificationRecord._id);
  }

  static async resendOtp(userId: string) {
    const user = await UserRepo.findById(userId);
    if (!user) throw new Error("User not found.");

    const existingCode = await VerificationCodeRepo.findByUserIdAndPurpose(userId, "email_verify");
    if (existingCode) {
      const now = new Date();
      if (now < existingCode.resendAfter) {
        const waitSeconds = Math.ceil((existingCode.resendAfter.getTime() - now.getTime()) / 1000);
        throw new Error(`Please wait ${waitSeconds} seconds before requesting a new code.`);
      }
      await VerificationCodeRepo.delete(existingCode._id!);
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const codeHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 1 * 60 * 1000);
    const resendAfter = new Date(Date.now() + 60 * 1000);

    await VerificationCodeRepo.create({
      userId: new ObjectId(userId),
      codeHash,
      purpose: "email_verify",
      expiresAt,
      resendAfter,
      attempts: 0,
    });

    await sendOtpEmail(user.email, otp);

    return { message: "OTP resent successfully." };
  }

  /** Forgot password: send reset code only if user exists. Purpose is reset_password. */
  static async forgotPassword(email: string) {
    const user = await UserRepo.findByEmail(email);
    if (!user) {
      throw new Error("No account found with this email.");
    }
    const userId = String(user._id);

    const existingCode = await VerificationCodeRepo.findByUserIdAndPurpose(userId, "reset_password");
    if (existingCode) await VerificationCodeRepo.delete(existingCode._id!);

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const codeHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 1 * 60 * 1000);
    const resendAfter = new Date(Date.now() + 60 * 1000);

    await VerificationCodeRepo.create({
      userId: new ObjectId(userId),
      codeHash,
      purpose: "reset_password",
      expiresAt,
      resendAfter,
      attempts: 0,
    });

    await sendOtpResetEmail(user.email, otp);

    return { userId, message: "Reset code sent to email." };
  }

  /** Resend reset code for forgot-password flow. Deletes old code, sends new one (expires in 1 min). */
  static async resendResetCode(userId: string) {
    const user = await UserRepo.findById(userId);
    if (!user) throw new Error("User not found.");

    const existingCode = await VerificationCodeRepo.findByUserIdAndPurpose(userId, "reset_password");
    if (existingCode) {
      await VerificationCodeRepo.delete(existingCode._id!);
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const codeHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 1 * 60 * 1000);
    const resendAfter = new Date(Date.now() + 60 * 1000);
    
    await VerificationCodeRepo.create({
      userId: new ObjectId(userId),
      codeHash,
      purpose: "reset_password",
      expiresAt,
      resendAfter,
      attempts: 0,
    });

    await sendOtpResetEmail(user.email, otp);

    return { message: "Reset code resent. It expires in 1 minute." };
  }

  /** Verify reset_password code so user can proceed to set new password. */
  static async verifyResetCode(userId: string, code: string) {
    const user = await UserRepo.findById(userId);
    if (!user) throw new Error("User not found.");

    const record = await VerificationCodeRepo.findByUserIdAndPurpose(userId, "reset_password");
    if (!record) throw new Error("No reset code found. Request a new one.");
    if (new Date() > record.expiresAt) {
      await VerificationCodeRepo.delete(record._id!);
      throw new Error("Reset code expired. Request a new one.");
    }
    if ((record.attempts ?? 0) >= 5) {
      await VerificationCodeRepo.delete(record._id!);
      throw new Error("Too many failed attempts. Request a new code.");
    }

    const valid = await bcrypt.compare(code, record.codeHash);
    if (!valid) {
      await VerificationCodeRepo.update({
        _id: record._id,
        attempts: (record.attempts ?? 0) + 1,
      });
      throw new Error("Invalid reset code.");
    }

    return { message: "Code valid. Proceed to set new password." };
  }

  /** Set new password after forgot-password flow. Requires a valid reset_password code to exist (user must have verified code first). */
  static async resetPasswordForgot(userId: string, newPassword: string) {
    const user = await UserRepo.findById(userId);
    if (!user) throw new Error("User not found.");


    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await UserAuthRepo.update({ userId, password: hashedPassword });

    return { message: "Password reset successfully. You can now log in." };
  }

  static async setPassword(userId: string, plainPassword: string): Promise<void> {
    const user = await UserRepo.findById(userId);
    if (!user) throw new Error("User not found.");
    if (user.signupStep !== "set_password") {
      throw new Error(`Invalid step. Expected set_password, got ${user.signupStep}.`);
    }

    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    await UserAuthRepo.update({ userId, password: hashedPassword });
    await UserRepo.update({ _id: userId, signupStep: "completed", signupCompleted: true });
  }

  static async loginWithEmailPassword(email: string, password: string) {
    const user = await UserRepo.findByEmail(email);
    if (!user) {
      throw new Error("No account found with this email.");
    }
    if (!user.signupCompleted) {
      throw new Error("Signup not completed. Complete all steps to log in.");
    }
    const auth = await UserAuthRepo.findByUserId(user._id!);
    if (!auth) {
      throw new Error("No account found with this email.");
    }
    if (!auth.password) {
      throw new Error("This account uses Google sign-in. Please log in with Google.");
    }
    const isPasswordValid = await bcrypt.compare(password, auth.password);
    if (!isPasswordValid) {
      throw new Error("Incorrect password.");
    }
    const userId = String(user._id);
    const accessToken = createAccessToken({ userId, email: user.email });
    const refreshToken = createRefreshToken({ userId, email: user.email });
    
    return {
      user,
      accessToken,
      refreshToken,
      requiresProfileCompletion: !user.isCompleteProfile,
    };
  }

  /** Change password for authenticated user (requires current password). */
  static async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const auth = await UserAuthRepo.findByUserId(userId);
    if (!auth) throw new Error("User not found.");
    if (!auth.password) {
      throw new Error("This account uses Google sign-in. Use forgot password to set a password.");
    }
    const isCurrentValid = await bcrypt.compare(currentPassword, auth.password);
    if (!isCurrentValid) throw new Error("Current password is incorrect.");
    if (currentPassword === newPassword) {
      throw new Error("New password must be different from your current password.");
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await UserAuthRepo.update({ userId, password: hashedPassword });
    return { message: "Password changed successfully." };
  }

  static async loginOrRegisterGoogle(idToken: string) {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload?.email || !payload.sub) {
      throw new Error("Invalid Google token.");
    }

    const email = payload.email;
    const googleId = payload.sub;

    let user = await UserRepo.findByEmail(email);

    if (!user) {
      const userResult = await UserRepo.create({
        email,
        signupStep: "completed",
        signupCompleted: true,
        isCompleteProfile: false,
      });
      await UserAuthRepo.createForGoogleRegister(userResult.insertedId, googleId);
      user = await UserRepo.findById(userResult.insertedId);
    } else {
      const auth = await UserAuthRepo.findByUserId(user._id!);
      if (!auth?.googleId) {
        await UserAuthRepo.linkGoogleId(user._id!, googleId);
      }
    }

    const userId = String(user!._id);
    const accessToken = createAccessToken({ userId, email: user!.email });
    const refreshToken = createRefreshToken({ userId, email: user!.email });
    return {
      user,
      accessToken,
      refreshToken,
      requiresProfileCompletion: !user!.isCompleteProfile,
    };
  }
}
