import express from "express";
import authRoutes from "./user.auth.route";
import airportRoutes from "./airport.route";
import terminalEchoRoutes from "./terminal.echo.route";
import terminalEchoReplyRoutes from "./terminal.echo.reply.route";
import s3Routes from "./s3.route";
import flightTicketRoutes from "./flight.ticket.route";
import psRoutes from "./ps.route";
import dtRoutes from "./dt.route";
import sessionMiddleware from "../middleware/valid-session.middleware";

const router = express.Router();

router.get("/v1", (_, res) => {
  res.json({
    message: "Welcome to my API",
  });
});

router.use("/auth", authRoutes);
router.use("/s3", s3Routes);
router.use("/terminal-echo", terminalEchoRoutes);
router.use("/terminal-echo-reply", terminalEchoReplyRoutes);
router.use("/airport", sessionMiddleware, airportRoutes);
router.use("/flight-ticket", sessionMiddleware, flightTicketRoutes);
router.use("/ps", sessionMiddleware, psRoutes);
router.use("/dt", sessionMiddleware, dtRoutes);

export default router;