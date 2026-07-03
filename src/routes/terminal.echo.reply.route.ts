import express from "express";
const router = express.Router();

import TerminalEchoReplyCtrl from "../controllers/terminal.echo.reply.controller";
import sessionMiddleware from "../middleware/valid-session.middleware";

// GET is public — anyone can read replies (controller handles optional userId for reactions)
router.get("/", TerminalEchoReplyCtrl.getByTerminalEchoId);

// POST and PATCH require authentication
router.post("/", sessionMiddleware, TerminalEchoReplyCtrl.create);
router.patch("/:id/listen", sessionMiddleware, TerminalEchoReplyCtrl.incrementListen);
router.patch("/:id/reaction", sessionMiddleware, TerminalEchoReplyCtrl.updateReaction);

export default router;