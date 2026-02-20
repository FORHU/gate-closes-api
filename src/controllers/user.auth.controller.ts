import { Request, Response } from "express";
import Joi from "joi";
import UserSvc from "../services/user.service";
import UserAuthSvc from "../services/user.auth.service";
import UserRepo from "../repositories/user.repository";
import { verifyRefreshToken, createAccessToken } from "../utils/jwt";

export default class AuthController {
  /** SignupStep1: Send OTP to email (and verify email ownership request). */
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
      const { userId, signupStep } = await UserAuthSvc.registerEmailAndSendOtp(value.email);
      const message =
        signupStep === "set_password"
          ? "Email already verified. Proceed to set password."
          : "OTP sent to email.";
      return res.status(201).json({
        message,
        userId,
        signupStep,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Server error.";
      const status =
        message === "Email already registered."
          ? 400
          : 500;
      return res.status(status).json({ message });
    }
  }

  /** SignupStep2: Submit OTP to verify email (must match sent OTP). */
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
      return res.json({
        message: "Email verified. Proceed to set password.",
        signupStep: "set_password",
      });
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  }

  /** SignupStep3: Set password. */
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
      return res.status(200).json({
        message: "Password set. Proceed to set gender.",
        signupStep: "completed",
      });
    } catch (error: any) {
      const status =
        error.message?.startsWith("Invalid step.") || error.message === "Email not verified."
          ? 400
          : 500;
      return res.status(status).json({ message: error.message || "Server error." });
    }
  }

  /** Forgot password: send reset code to email (only if user exists). */
  static async forgotPassword(req: Request, res: Response) {
    const { email } = req.body;
    const schema = Joi.object({
      email: Joi.string().email().required(),
    });
    const { error, value } = schema.validate({ email });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const { userId, message } = await UserAuthSvc.forgotPassword(value.email);
      return res.status(200).json({
        message,
        userId,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Server error.";
      const status = message === "No account found with this email." ? 404 : 500;
      return res.status(status).json({ message });
    }
  }

  /** Resend reset code for forgot-password flow (deletes old code, new code expires in 1 min). */
  static async resendResetCode(req: Request, res: Response) {
    const { userId } = req.body;
    const schema = Joi.object({
      userId: Joi.string().required(),
    });
    const { error, value } = schema.validate({ userId });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const { message } = await UserAuthSvc.resendResetCode(value.userId);
      return res.status(200).json({ message });
    } catch (error: any) {
      const status = error.message === "User not found." ? 404 : 500;
      return res.status(status).json({ message: error.message || "Server error." });
    }
  }

  /** Verify reset code so user can enter new password. */
  static async verifyResetCode(req: Request, res: Response) {
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
      const { message } = await UserAuthSvc.verifyResetCode(value.userId, value.code);
      return res.status(200).json({ message });
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  }

  /** Set new password (forgot-password flow). Body: userId, password, confirmPassword. User must have verified reset code first. */
  static async resetPassword(req: Request, res: Response) {
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
      const { message } = await UserAuthSvc.resetPasswordForgot(value.userId, value.password);
      return res.status(200).json({ message });
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  }

  /** Resend OTP code for email verification. */
  static async resendCode(req: Request, res: Response) {
    const { userId } = req.body;
    const schema = Joi.object({
      userId: Joi.string().required(),
    });
    const { error, value } = schema.validate({ userId });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      await UserAuthSvc.resendOtp(value.userId);
      return res.status(200).json({
        message: "OTP resent successfully.",
      });
    } catch (error: any) {
      const status =
        error.message?.startsWith("Cannot resend OTP") ||
        error.message?.startsWith("Please wait") ||
        error.message === "User not found."
          ? 400
          : 500;
      return res.status(status).json({ message: error.message || "Server error." });
    }
  }

  /** Set username and gender (SignupComplete step). */
  static async setUsernameGender(req: Request, res: Response) {
    const { userId, username, gender } = req.body;
    const schema = Joi.object({
      userId: Joi.string().required(),
      username: Joi.string().pattern(/^[A-Za-z]+\d{1,3}\.\d{2}$/).required(),
      gender: Joi.string().valid("Male", "Female").required(),
    });
    const { error, value } = schema.validate({ userId, username, gender });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const user = await UserSvc.setUsernameGender(value.userId, value.gender, value.username);
      return res.json({
        message: "Username and gender set successfully. Signup completed.",
        user,
        signupStep: "completed",
        signupCompleted: true,
      });
    } catch (error: any) {
      const status = error.message?.startsWith("Invalid step.") ? 400 : 500;
      return res.status(status).json({ message: error.message || "Server error." });
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
      const { user, accessToken, refreshToken, requiresProfileCompletion } =
        await UserAuthSvc.loginWithEmailPassword(value.email, value.password);
      
      let responseMessage = "Login successful.";
      if (!user.signupCompleted) {
        responseMessage = "Please complete signup to continue.";
      } else if (!user.isCompleteProfile) {
        responseMessage = "Login successful. Please complete your profile.";
      }

      return res.status(200).json({
        message: responseMessage,
        user,
        accessToken,
        refreshToken,
        requiresProfileCompletion,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Server error.";
      const status =
        message === "No account found with this email. Please sign up first." ||
        message === "Incorrect password." ||
        message === "Signup not completed. Complete all steps to log in."
          ? 401
          : message === "This account uses Google sign-in. Please log in with Google."
          ? 400
          : 500;
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
      const { user, accessToken, refreshToken, requiresProfileCompletion } =
        await UserAuthSvc.loginOrRegisterGoogle(value.idToken);
      
      if (!user) {
        return res.status(500).json({ message: "Failed to retrieve user data." });
      }

      let responseMessage = "Google login successful.";
      if (!user.isCompleteProfile) {
        responseMessage = "Google login successful. Please complete your profile.";
      }

      return res.status(200).json({
        message: responseMessage,
        user,
        accessToken,
        refreshToken,
        requiresProfileCompletion,
      });
    } catch (error: any) {
      return res.status(500).json({ message: error.message || "Server error." });
    }
  }

  /** Change password (authenticated). Body: currentPassword, newPassword, confirmPassword. */
  static async changePassword(req: Request, res: Response) {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const schema = Joi.object({
      currentPassword: Joi.string().required(),
      newPassword: Joi.string().min(8).required(),
      confirmPassword: Joi.string().valid(Joi.ref("newPassword")).required(),
    });
    const { error, value } = schema.validate({
      currentPassword,
      newPassword,
      confirmPassword,
    });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const result = await UserAuthSvc.changePassword(
        userId,
        value.currentPassword,
        value.newPassword
      );
      return res.status(200).json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Server error.";
      const status =
        message === "Current password is incorrect."
          ? 401
          : message === "New password must be different from your current password."
            ? 400
            : message.startsWith("This account uses Google")
              ? 400
              : 500;
      return res.status(status).json({ message });
    }
  }

  /** Change username (authenticated). Body: username (format e.g. A123.45). */
  static async changeUsername(req: Request, res: Response) {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const { username } = req.body;
    const schema = Joi.object({
      username: Joi.string().pattern(/^[A-Za-z]+\d{1,3}\.\d{2}$/).required(),
    });
    const { error, value } = schema.validate({ username });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const user = await UserSvc.changeUsername(userId, value.username);
      return res.status(200).json({
        message: "Username updated successfully.",
        user,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Server error.";
      const status =
        message === "Username is already taken." ? 409 : message === "User not found." ? 404 : 500;
      return res.status(status).json({ message });
    }
  }

  /** Get current user (requires valid session). */
  static async me(req: Request, res: Response) {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const user = await UserRepo.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }
      return res.status(200).json({
        user,
        requiresProfileCompletion: !user.isCompleteProfile,
      });
    } catch {
      return res.status(500).json({ message: "Server error." });
    }
  }
}
