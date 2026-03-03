import express from "express";
const router = express.Router();

import TerminalEchoReplyCtrl from "../controllers/terminal.echo.reply.controller";

router.get("/", TerminalEchoReplyCtrl.getByTerminalEchoId);
router.post("/", TerminalEchoReplyCtrl.create);
router.patch("/:id/listen", TerminalEchoReplyCtrl.incrementListen);
router.patch("/:id/reaction", TerminalEchoReplyCtrl.updateReaction);

export default router;

