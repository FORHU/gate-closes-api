import bcrypt from "bcrypt";
import { OAuth2Client } from "google-auth-library";
import UserAuthRepo from "../repositories/user.auth.repository";
import UserRepo from "../repositories/user.repository";
import VerificationCodeRepo from "../repositories/verification.code.repository";
import { sendOtpEmail } from "./send.otp.service";
import { GOOGLE_CLIENT_ID } from "../config";

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

export default class UserAuthSvc {

  static async registerEmailAndSendOtp(email: string) {
    const existingUser = await UserRepo.findByEmail(email);
    if (existingUser) {
      throw new Error("Email already registered.");
    }
    const userResult = await UserRepo.createForManualRegister(email);
    await UserAuthRepo.createForManualRegister(userResult.insertedId);

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const codeHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const resendAfter = new Date(Date.now() + 60 * 1000);

    await VerificationCodeRepo.create({
      userId: userResult.insertedId,
      codeHash,
      purpose: "email_verify",
      expiresAt,
      resendAfter,
      attempts: 0,
    });

    await sendOtpEmail(email, otp);

    return { userId: String(userResult.insertedId) };
  }

  static async verifyEmailWithCode(userId: string, code: string) {
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

    await UserAuthRepo.update({userId,  emailVerified: true });
    await VerificationCodeRepo.delete(verificationRecord._id);
  }

  static async setPassword(userId: string, plainPassword: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    await UserAuthRepo.update({ userId, password: hashedPassword, hasPassword: true });
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
      const userResult = await UserRepo.create({ email, isProfileCompleted: false });
      await UserAuthRepo.createForGoogleRegister(userResult.insertedId, googleId);
      user = await UserRepo.findById(userResult.insertedId);
    } else {
      const auth = await UserAuthRepo.findByUserId(user._id!);
      if (!auth?.googleId) {
        await UserAuthRepo.linkGoogleId(user._id!, googleId);
      }
    }

    return { user: user};
  }
}
