import express from "express";
import authRoutes from "./user.auth.route";
import airportRoutes from "./airport.route";
import terminalEchoRoutes from "./terminal.echo.route";
import sessionMiddleware from "../middleware/valid-session.middleware";

const router = express.Router();

router.get("/v1", (_, res) => {
  res.json({
    message: "Welcome to my API",
  });
});

router.use("/auth", authRoutes);

// Protected routes (require valid session: Authorization Bearer <accessToken>)
router.use("/airport", sessionMiddleware, airportRoutes);
router.use("/terminal-echo", sessionMiddleware, terminalEchoRoutes);

export default router;
