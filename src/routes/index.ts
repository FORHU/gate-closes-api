import express from "express";
import authRoutes from "./user.auth.route";
import airportRoutes from "./airport.route";
import terminalEchoRoutes from "./terminal.echo.route";
import terminalEchoReplyRoutes from "./terminal.echo.reply.route";
import s3Routes from "./s3.route";
import flightTicketRoutes from "./flight.ticket.route";
import conversationRoutes from "./conversation.route";
import offerRoutes from "./offer.route";
import adminOfferRoutes from "./admin.offer.route";
import adminUserRoutes from "./admin.user.route";
import adminRoleRoutes from "./admin.role.route";
import AdminRoleCtrl from "../controllers/admin.role.controller";
import requirePermission from "../middleware/permission.middleware";
import sessionMiddleware from "../middleware/valid-session.middleware";

const router = express.Router();

router.get("/v1", (_, res) => {
  res.json({
    message: "Welcome to my API gatecloses testing...",
  });
});

router.use("/auth", authRoutes);
router.use("/s3", s3Routes);
router.use("/terminal-echo", terminalEchoRoutes);
router.use("/terminal-echo-reply", terminalEchoReplyRoutes);
router.use("/airport", sessionMiddleware, airportRoutes);
router.use("/flight-ticket", sessionMiddleware, flightTicketRoutes);
router.use("/conversations", sessionMiddleware, conversationRoutes);
router.use("/offers", sessionMiddleware, offerRoutes);
router.use("/admin/offers", sessionMiddleware, adminOfferRoutes);
router.use("/admin/users", sessionMiddleware, adminUserRoutes);
router.use("/admin/roles", sessionMiddleware, adminRoleRoutes);
router.get(
  "/admin/permissions",
  sessionMiddleware,
  requirePermission("users:read"),
  AdminRoleCtrl.listPermissions
);

export default router;
