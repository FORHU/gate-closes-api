import express from "express";
import authRoutes from "./user.auth.route";
import airportRoutes from "./airport.route";
import terminalEchoRoutes from "./terminal.echo.route";
import s3Routes from "./s3.route";
import sessionMiddleware from "../middleware/valid-session.middleware";

const router = express.Router();

router.get("/v1", (_, res) => {
  res.json({
    message: "Welcome to my API",
  });
});

router.use("/auth", authRoutes);
router.use("/s3", s3Routes);


// Protected routes (require valid session: Authorization Bearer <accessToken>)
router.use("/terminal-echo", sessionMiddleware, terminalEchoRoutes);
router.use("/airport", sessionMiddleware, airportRoutes);

export default router;
