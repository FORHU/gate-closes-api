import express from "express";
const router = express.Router();

import AuthController from "../controllers/user.auth.controller";

router.post("/register-email", AuthController.registerEmail);
router.post("/verify-email", AuthController.verifyEmail);
router.post("/set-password", AuthController.setPassword);
router.post("/complete-profile", AuthController.completeProfile);
router.post("/login", AuthController.login);
router.post("/refresh", AuthController.refresh);
router.post("/login-or-register-google", AuthController.loginOrRegisterGoogle);

export default router;
