import express from "express";
const router = express.Router();

import AuthController from "../controllers/user.auth.controller";
import sessionMiddleware from "../middleware/valid-session.middleware";

// Signup flow
router.post("/register-email", AuthController.registerEmail);
router.post("/verify-email", AuthController.verifyEmail);
router.post("/resend-code", AuthController.resendCode);
router.post("/set-password", AuthController.setPassword);
router.post("/set-username-gender", AuthController.setUsernameGender);

// Forgot password flow
router.post("/forgot-password", AuthController.forgotPassword);
router.post("/resend-reset-code", AuthController.resendResetCode);
router.post("/verify-reset-code", AuthController.verifyResetCode);
router.post("/reset-password", AuthController.resetPassword);

// Login flow
router.post("/login", AuthController.login);
router.post("/refresh", AuthController.refresh);
router.post("/login-or-register-google", AuthController.loginOrRegisterGoogle);

// Session (protected)
router.get("/me", sessionMiddleware, AuthController.me);
router.post("/change-password", sessionMiddleware, AuthController.changePassword);
router.post("/change-username", sessionMiddleware, AuthController.changeUsername);
router.post("/update-profile", sessionMiddleware, AuthController.updateProfile);

export default router;
