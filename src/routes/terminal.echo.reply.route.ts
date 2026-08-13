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

// sessionMiddleware required (not actually "public" — the comment this
// replaced described a state that was never reachable: without it, req.user
// is never populated for ANY caller, including logged-in ones, which
// silently broke each reply's currentUserReactions on every fetch). This
// app has no genuinely anonymous read path (every screen requires login),
// so there's no public-access behavior lost here.
router.get("/", sessionMiddleware, TerminalEchoReplyCtrl.getByTerminalEchoId);

// Fetch a single reply by id — used by the frontend to append a newly
// created reply to an already-loaded thread, instead of re-fetching
// the entire reply list every time one new reply arrives.
router.get("/:id", sessionMiddleware, TerminalEchoReplyCtrl.getById);

// POST and PATCH require authentication
router.post("/", sessionMiddleware, TerminalEchoReplyCtrl.create);
router.patch("/:id/listen", sessionMiddleware, TerminalEchoReplyCtrl.incrementListen);
router.patch("/:id/reaction", sessionMiddleware, TerminalEchoReplyCtrl.updateReaction);

export default router;