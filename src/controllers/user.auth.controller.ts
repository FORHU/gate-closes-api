import { Request, Response } from "express";
import Joi from "joi";
import UserSvc from "../services/user.service";
import UserAuthSvc from "../services/user.auth.service";
import { verifyRefreshToken, createAccessToken } from "../utils/jwt";

export default class AuthController {
  static async registerEmail(req: Request, res: Response) {
    const { email } = req.body;

    const schema = Joi.object({
      email: Joi.string().email().required(),
    });
    const { error, value } = schema.validate({ email });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const { userId } = await UserAuthSvc.registerEmailAndSendOtp(value.email);
      return res.status(201).json({
        message: "Verification code sent to email.",
        userId,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Server error.";
      const status = message === "Email already registered." ? 400 : 500;
      return res.status(status).json({ message });
    }
  }

  static async verifyEmail(req: Request, res: Response) {
    const { userId, code } = req.body;
    const schema = Joi.object({
      userId: Joi.string().required(),
      code: Joi.string().length(4).required(),
    });
    const { error, value } = schema.validate({ userId, code });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      await UserAuthSvc.verifyEmailWithCode(value.userId, value.code);
      return res.json({ message: "Email verified successfully." });
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  }

  static async setPassword(req: Request, res: Response) {
    const { userId, password, confirmPassword } = req.body;
    const schema = Joi.object({
      userId: Joi.string().required(),
      password: Joi.string().min(8).required(),
      confirmPassword: Joi.string().valid(Joi.ref("password")).required(),
    });
    const { error, value } = schema.validate({ userId, password, confirmPassword });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      await UserAuthSvc.setPassword(value.userId, value.password);
      return res.status(200).json({ message: "Password set successfully." });
    } catch (error: any) {
      return res.status(500).json({ message: error.message || "Server error." });
    }
  }

  static async login(req: Request, res: Response) {
    const { email, password } = req.body;
    const schema = Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required(),
    });
    const { error, value } = schema.validate({ email, password });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const { user, accessToken, refreshToken } = await UserAuthSvc.loginWithEmailPassword(
        value.email,
        value.password
      );
      return res.status(200).json({
        message: "Login successful.",
        user,
        accessToken,
        refreshToken,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Server error.";
      const status = message === "Invalid email or password." || message === "Email not verified." || message === "Password not set. Complete registration first." ? 401 : 500;
      return res.status(status).json({ message });
    }
  }

  static async refresh(req: Request, res: Response) {
    const { refreshToken } = req.body;
    const schema = Joi.object({
      refreshToken: Joi.string().required(),
    });
    const { error, value } = schema.validate({ refreshToken });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const payload = verifyRefreshToken(value.refreshToken);
      const accessToken = createAccessToken({ userId: payload.userId, email: payload.email });
      return res.status(200).json({ accessToken });
    } catch {
      return res.status(401).json({ message: "Invalid or expired refresh token." });
    }
  }

  static async completeProfile(req: Request, res: Response) {
    const { userId, gender } = req.body;
    const schema = Joi.object({
      userId: Joi.string().required(),
      gender: Joi.string().valid("Male", "Female").required(),
    });
    const { error, value } = schema.validate({ userId, gender });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const user = await UserSvc.completeProfile(value.userId, value.gender);
      return res.json({
        message: "Profile completed successfully.",
        user,
      });
    } catch (error: any) {
      return res.status(500).json({ message: error.message || "Server error." });
    }
  }

  static async loginOrRegisterGoogle(req: Request, res: Response) {
    const { idToken } = req.body;
    const schema = Joi.object({ 
      idToken: Joi.string().required(),
    });
    const { error, value } = schema.validate({ idToken });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const { user, accessToken, refreshToken } = await UserAuthSvc.loginOrRegisterGoogle(value.idToken);
      return res.status(200).json({
        message: "Google login successful.",
        user,
        accessToken,
        refreshToken,
      });
    } catch (error: any) {
      return res.status(500).json({ message: error.message || "Server error." });
    }
  }
}
