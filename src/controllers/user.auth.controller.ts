import { Request, Response } from "express";
import Joi from "joi";
import UserSvc from "../services/user.service";
import UserAuthSvc from "../services/user.auth.service";
import UserRepo from "../repositories/user.repository";
import { verifyRefreshToken, createAccessToken, createRefreshToken } from "../utils/jwt";
import RefreshSessionStore from "../utils/refresh.session.store";
import { passwordSchema } from "../utils/password.validator";
import { getSessionCookieOptions, getRefreshCookieOptions, getClearCookieOptions } from "../config";
import { roleNameOf } from "../domain/access/permissions";
import RoleSvc from "../services/role.service";

function isWebClient(req: Request): boolean {
  const client = (req.headers?.["x-client-type"] || req.query?.client || "") as string;
  return typeof client === "string" && client.trim().toLowerCase() === "web";
}

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
      const status = message === "Email already registered." ? 400 : 500;
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
    } catch (error) {
      const message = error instanceof Error ? error.message : "Server error.";
      return res.status(400).json({ message });
    }
  }

  /** SignupStep3: Set password. */
  static async setPassword(req: Request, res: Response) {
    const { userId, password, confirmPassword } = req.body;
    const schema = Joi.object({
      userId: Joi.string().required(),
      password: passwordSchema,
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
    } catch (error) {
      const message = error instanceof Error ? error.message : "Server error.";
      const status =
        message.startsWith("Invalid step.") || message === "Email not verified." ? 400 : 500;
      return res.status(status).json({ message });
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
    } catch (error) {
      const message = error instanceof Error ? error.message : "Server error.";
      const status = message === "User not found." ? 404 : 500;
      return res.status(status).json({ message });
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
    } catch (error) {
      const message = error instanceof Error ? error.message : "Server error.";
      return res.status(400).json({ message });
    }
  }

  /** Set new password (forgot-password flow). Body: userId, password, confirmPassword. User must have verified reset code first. */
  static async resetPassword(req: Request, res: Response) {
    const { userId, password, confirmPassword } = req.body;
    const schema = Joi.object({
      userId: Joi.string().required(),
      password: passwordSchema,
      confirmPassword: Joi.string().valid(Joi.ref("password")).required(),
    });
    const { error, value } = schema.validate({ userId, password, confirmPassword });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const { message } = await UserAuthSvc.resetPasswordForgot(value.userId, value.password);
      return res.status(200).json({ message });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Server error.";
      return res.status(400).json({ message });
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
    } catch (error) {
      const message = error instanceof Error ? error.message : "Server error.";
      const status =
        message.startsWith("Cannot resend OTP") ||
        message.startsWith("Please wait") ||
        message === "User not found."
          ? 400
          : 500;
      return res.status(status).json({ message });
    }
  }

  /** Set username and gender (SignupComplete step). */
  static async setUsernameGender(req: Request, res: Response) {
    const { userId, username, gender } = req.body;
    const schema = Joi.object({
      userId: Joi.string().required(),
      username: Joi.string()
        .pattern(/^(?!.*\.\.)(?!.*\.$)[a-zA-Z0-9._]{3,30}$/)
        .required(),
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
    } catch (error) {
      const message = error instanceof Error ? error.message : "Server error.";
      const status = message.startsWith("Invalid step.") ? 400 : 500;
      return res.status(status).json({ message });
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

      const isWeb = isWebClient(req);
      if (isWeb) {
        res.cookie("session_token", accessToken, getSessionCookieOptions());
        res.cookie("refresh_token", refreshToken, getRefreshCookieOptions());
        return res.status(200).json({
          message: responseMessage,
          user,
          requiresProfileCompletion,
        });
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
        message === "No account found with this email." ||
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
    const isWeb = isWebClient(req);
    const cookieRefreshToken = req.cookies?.refresh_token;
    const bodyRefreshToken = req.body?.refreshToken;

    const tokenToRefresh = isWeb ? cookieRefreshToken || bodyRefreshToken : bodyRefreshToken;

    if (!tokenToRefresh || typeof tokenToRefresh !== "string") {
      return res.status(400).json({ message: "Refresh token is required." });
    }

    try {
      const payload = verifyRefreshToken(tokenToRefresh);

      // Reuse detection (§Blocker 2). Tokens minted before this feature
      // shipped carry no `fam` claim — grandfather them into a brand-new
      // family on their first post-deploy refresh rather than rejecting
      // every currently-logged-in user. Every token minted from this
      // point forward always carries a family id, so this branch only
      // ever fires once per pre-existing session.
      let familyId = payload.fam;
      if (familyId && payload.jti && RefreshSessionStore.isAvailable()) {
        if (await RefreshSessionStore.isFamilyRevoked(familyId)) {
          return res.status(401).json({ message: "Session revoked. Please log in again." });
        }

        const record = await RefreshSessionStore.getToken(payload.jti);
        if (record?.status === "rotated") {
          // This exact refresh token was already used once before to
          // rotate — someone is replaying a stale token. Assume the
          // whole chain is compromised, not just this one request.
          await RefreshSessionStore.revokeFamily(familyId);
          return res
            .status(401)
            .json({ message: "Refresh token reuse detected. Please log in again." });
        }
        if (record?.status === "valid") {
          await RefreshSessionStore.markRotated(payload.jti, record);
        }
        // No record found: either a transient Redis gap at issuance time,
        // or (pre-existing behavior) Redis was unavailable when this
        // token was minted. Proceed without penalty — see file header.
      } else if (!familyId) {
        familyId = RefreshSessionStore.newFamilyId();
      }

      const accessToken = createAccessToken({ userId: payload.userId, email: payload.email });
      const newRefreshToken = createRefreshToken({
        userId: payload.userId,
        email: payload.email,
        fam: familyId,
      });

      if (familyId) {
        const newPayload = verifyRefreshToken(newRefreshToken);
        if (newPayload.jti) {
          await RefreshSessionStore.registerValid({
            jti: newPayload.jti,
            userId: payload.userId,
            familyId,
          });
        }
      }

      if (isWeb) {
        res.cookie("session_token", accessToken, getSessionCookieOptions());
        res.cookie("refresh_token", newRefreshToken, getRefreshCookieOptions());
        return res.status(200).json({ message: "Session refreshed." });
      }

      return res.status(200).json({ accessToken, refreshToken: newRefreshToken });
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

      const isWeb = isWebClient(req);
      if (isWeb) {
        res.cookie("session_token", accessToken, getSessionCookieOptions());
        res.cookie("refresh_token", refreshToken, getRefreshCookieOptions());
        return res.status(200).json({
          message: responseMessage,
          user,
          requiresProfileCompletion,
        });
      }

      return res.status(200).json({
        message: responseMessage,
        user,
        accessToken,
        refreshToken,
        requiresProfileCompletion,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Server error.";
      return res.status(500).json({ message });
    }
  }

  /** Change password (authenticated). Body: currentPassword, newPassword, confirmPassword. */
  static async changePassword(req: Request, res: Response) {
    const userId = req.user?.userId as string;
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const schema = Joi.object({
      currentPassword: Joi.string().required(),
      newPassword: passwordSchema,
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
    const userId = req.user?.userId as string;
    const { username } = req.body;
    const schema = Joi.object({
      username: Joi.string()
        .pattern(/^(?!.*\.\.)(?!.*\.$)[a-zA-Z0-9._]{3,30}$/)
        .required(),
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

  /** Change gender (authenticated). Body: gender ("Male" | "Female"). */
  static async changeGender(req: Request, res: Response) {
    const userId = req.user?.userId as string;
    const { gender } = req.body;
    const schema = Joi.object({
      gender: Joi.string().valid("Male", "Female").required(),
    });
    const { error, value } = schema.validate({ gender });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const user = await UserSvc.changeGender(userId, value.gender);
      return res.status(200).json({
        message: "Gender updated successfully.",
        user,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Server error.";
      const status = message === "User not found." ? 404 : 500;
      return res.status(status).json({ message });
    }
  }

  /**
   * Edit profile (authenticated). Body: username and/or gender — at least one required.
   * Validated against req.body directly (not a destructured {username, gender} object) so
   * `.min(1)` only counts keys the client actually sent, not undefined placeholders.
   */
  static async editProfile(req: Request, res: Response) {
    const userId = req.user?.userId as string;
    const schema = Joi.object({
      username: Joi.string()
        .pattern(/^(?!.*\.\.)(?!.*\.$)[a-zA-Z0-9._]{3,30}$/)
        .optional(),
      gender: Joi.string().valid("Male", "Female").optional(),
    }).min(1);
    const { error, value } = schema.validate(req.body, { stripUnknown: true });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const user = await UserSvc.editProfile(userId, value);
      return res.status(200).json({
        message: "Profile updated successfully.",
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
    const userId = req.user?.userId as string;
    try {
      const user = await UserRepo.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }
      const role = roleNameOf(user);
      return res.status(200).json({
        user: { ...user, role },
        permissions: await RoleSvc.permissionsFor(role),
        requiresProfileCompletion: !user.isCompleteProfile,
      });
    } catch {
      return res.status(500).json({ message: "Server error." });
    }
  }

  /** Logout: revokes the session family server-side (if a refresh token is presented) and clears cookies. */
  static async logout(req: Request, res: Response) {
    const cookieRefreshToken = req.cookies?.refresh_token;
    const bodyRefreshToken = req.body?.refreshToken;
    const token = cookieRefreshToken || bodyRefreshToken;

    if (token && typeof token === "string") {
      try {
        const payload = verifyRefreshToken(token);
        if (payload.fam) {
          await RefreshSessionStore.revokeFamily(payload.fam);
        }
      } catch {
        // Already invalid/expired — nothing server-side left to revoke.
      }
    }

    res.clearCookie("session_token", getClearCookieOptions());
    res.clearCookie("refresh_token", getClearCookieOptions());
    return res.status(200).json({ message: "Logged out successfully." });
  }
}
