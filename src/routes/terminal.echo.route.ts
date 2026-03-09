import express from "express";
const router = express.Router();

import TerminalEchoCtrl from "../controllers/terminal.echo.controller";
import sessionMiddleware from "../middleware/valid-session.middleware";

router.get("/", TerminalEchoCtrl.search);
router.post("/", sessionMiddleware, TerminalEchoCtrl.create);
router.patch("/:id/listen", TerminalEchoCtrl.incrementListen);
router.patch("/:id/reaction", sessionMiddleware, TerminalEchoCtrl.updateReaction);

export default router;

