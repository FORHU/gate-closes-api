import express from "express";
const router = express.Router();

import TerminalEchoCtrl from "../controllers/terminal.echo.controller";
import sessionMiddleware from "../middleware/valid-session.middleware";
import { echoCreationRateLimiter } from "../middleware/rate-limiter.middleware";

router.get("/", sessionMiddleware, TerminalEchoCtrl.search);
router.get("/map", sessionMiddleware, TerminalEchoCtrl.getMap);
router.get("/:id", sessionMiddleware, TerminalEchoCtrl.getById);
router.post("/", sessionMiddleware, echoCreationRateLimiter, TerminalEchoCtrl.create);
router.patch("/:id/listen", TerminalEchoCtrl.incrementListen);
router.patch("/:id/reaction", sessionMiddleware, TerminalEchoCtrl.updateReaction);

export default router;

