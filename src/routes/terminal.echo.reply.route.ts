/**
 * Route registration for /api/terminal-echo-reply.
 *
 * ROUTE ORDER MATTERS: GET "/" (list all replies for a thread, via
 * ?terminalEchoId= query param) and GET "/:id" (fetch a single reply)
 * are structurally distinct paths, so order between them doesn't
 * actually create ambiguity here — but keeping the more specific
 * static route first is still good practice as more routes get added
 * later.
 */

import express from "express";
const router = express.Router();

import TerminalEchoReplyCtrl from "../controllers/terminal.echo.reply.controller";
import sessionMiddleware from "../middleware/valid-session.middleware";

// GET is public — anyone can read replies (controller handles optional userId for reactions)
router.get("/", TerminalEchoReplyCtrl.getByTerminalEchoId);

// Fetch a single reply by id — used by the frontend to append a newly
// created reply to an already-loaded thread, instead of re-fetching
// the entire reply list every time one new reply arrives.
router.get("/:id", TerminalEchoReplyCtrl.getById);

// POST and PATCH require authentication
router.post("/", sessionMiddleware, TerminalEchoReplyCtrl.create);
router.patch("/:id/listen", sessionMiddleware, TerminalEchoReplyCtrl.incrementListen);
router.patch("/:id/reaction", sessionMiddleware, TerminalEchoReplyCtrl.updateReaction);

export default router;