import { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import bcrypt from "bcrypt";
import UserSvc from "../services/user.service";
import UserAuthSvc from "../services/user.auth.service";
import VerificationCodeSvc from "../services/verification.code.service";
import { sendOtpEmail } from "../services/send.otp.service";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

export default class AuthController {
  //* STEP 1: Register email and send OTP
  static async registerEmail(req: Request, res: Response) {
    try {
      const { email } = req.body;

      const existingUser = await UserSvc.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered." });
      }
      const userResult = await UserSvc.createForManualRegister(email);
      await UserAuthSvc.createForManualRegister(userResult.insertedId);

      const otp = Math.floor(1000 + Math.random() * 9000).toString();
      const codeHash = await bcrypt.hash(otp, 10);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      const resendAfter = new Date(Date.now() + 60 * 1000);

      await VerificationCodeSvc.create({
        userId: userResult.insertedId,
        codeHash,
        purpose: "email_verify",
        expiresAt,
        resendAfter,
        attempts: 0,
      });

      await sendOtpEmail(email, otp);

      return res.status(201).json({
        message: "Verification code sent to email.",
        userId: userResult.insertedId,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Server error." });
    }
  }

  //* STEP 2: Verify email with OTP
  static async verifyEmail(req: Request, res: Response) {
    try {
      const { userId, code } = req.body;

      if (!userId || !code) {
        return res.status(400).json({ message: "userId and code are required." });
      }

      const verificationRecord = await VerificationCodeSvc.findByUserIdAndPurpose(
        userId,
        "email_verify"
      );

      if (!verificationRecord) {
        return res.status(400).json({ message: "No verification code found." });
      }

      if (new Date() > verificationRecord.expiresAt) {
        await VerificationCodeSvc.delete(verificationRecord._id);
        return res.status(400).json({ message: "Verification code expired." });
      }

      const maxAttempts = 5;
      if (verificationRecord.attempts && verificationRecord.attempts >= maxAttempts) {
        await VerificationCodeSvc.delete(verificationRecord._id);
        return res.status(400).json({ message: "Too many failed attempts. Request a new code." });
      }

      const isCodeValid = await bcrypt.compare(code, verificationRecord.codeHash);

      if (!isCodeValid) {
        await VerificationCodeSvc.update({
          _id: verificationRecord._id,
          attempts: (verificationRecord.attempts || 0) + 1,
        });
        return res.status(400).json({ message: "Invalid verification code." });
      }

      await UserAuthSvc.verifyEmail(userId);
      await VerificationCodeSvc.delete(verificationRecord._id);

      return res.json({ message: "Email verified successfully." });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Server error." });
    }
  }

  //* STEP 3: Set password
  static async setPassword(req: Request, res: Response) {
    try {
      const { userId, password, confirmPassword } = req.body;

      if (!userId || !password || !confirmPassword) {
        return res.status(400).json({ message: "Missing required fields." });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({ message: "Passwords do not match." });
      }

      if (password.length < 8) {
        return res.status(400).json({
          message: "Password must be at least 8 characters long.",
        });
     }

      const hashedPassword = await bcrypt.hash(password, 10);
      await UserAuthSvc.setPassword(userId, hashedPassword);

      return res.status(200).json({ message: "Password set successfully." });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Server error." });
    }
  }

  // * STEP 4: Complete profile
  static async completeProfile(req: Request, res: Response) {
    try {
      const { userId, gender } = req.body;
      const user = await UserSvc.update({
        _id: userId,
        gender,
        isProfileCompleted: true,
      });

      return res.json({
        message: "Profile completed successfully.",
        user,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Server error." });
    }
  }

  // * Google login or register
  static async loginOrRegisterGoogle(req: Request, res: Response) {
    try {
      const { idToken } = req.body;

      if (!idToken) {
        return res.status(400).json({ message: "idToken is required." });
      }

      const ticket = await client.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID });

      const payload = ticket.getPayload();
      if (!payload || !payload.email || !payload.sub) {
        return res.status(400).json({ message: "Invalid Google token." });
      }

      const email = payload.email;
      const googleId = payload.sub;

      let user = await UserSvc.findByEmail(email);

      if (!user) {
        const userResult = await UserSvc.create({ email, isProfileCompleted: false });

        await UserAuthSvc.createForGoogleRegister( userResult.insertedId, googleId );

        user = await UserSvc.findById(userResult.insertedId);
      } else {
        const auth = await UserAuthSvc.findByUserId(user._id!);
        if (!auth?.googleId) {
          await UserAuthSvc.linkGoogleId(user._id!, googleId);
        }
      }

      return res.status(200).json({ message: "Google login successful.", user });
    } catch (err: any) {
      return res.status(500).json({ message: err.message || "Server error." });
    }
  }
}
