import express from "express";
const router = express.Router();

import AuthController from "../controllers/user.auth.controller";
import sessionMiddleware from "../middleware/valid-session.middleware";
import { authRateLimiter } from "../middleware/rate-limiter.middleware";

// Signup flow
router.post("/register-email", authRateLimiter, AuthController.registerEmail);
router.post("/verify-email", authRateLimiter, AuthController.verifyEmail);
router.post("/resend-code", authRateLimiter, AuthController.resendCode);
router.post("/set-password", AuthController.setPassword);
router.post("/set-username-gender", AuthController.setUsernameGender);

// Forgot password flow
router.post("/forgot-password", authRateLimiter, AuthController.forgotPassword);
router.post("/resend-reset-code", authRateLimiter, AuthController.resendResetCode);
router.post("/verify-reset-code", authRateLimiter, AuthController.verifyResetCode);
router.post("/reset-password", authRateLimiter, AuthController.resetPassword);

// Login flow
router.post("/login", authRateLimiter, AuthController.login);
router.post("/refresh", authRateLimiter, AuthController.refresh);
router.post("/login-or-register-google", authRateLimiter, AuthController.loginOrRegisterGoogle);

// Session (protected)
router.get("/me", sessionMiddleware, AuthController.me);
router.post("/change-password", sessionMiddleware, AuthController.changePassword);
router.post("/change-username", sessionMiddleware, AuthController.changeUsername);
router.post("/change-gender", sessionMiddleware, AuthController.changeGender);
router.patch("/edit-profile", sessionMiddleware, AuthController.editProfile);

export default router;
