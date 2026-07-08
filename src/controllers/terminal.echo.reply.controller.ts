/**
 * ─────────────────────────────────────────────────────────────
 * HTTP layer for terminal echo replies.
 *
 * SOCKET PAYLOAD STRATEGY — FULL DATA, NOT JUST AN ID:
 * After creating a reply, this controller re-fetches the FULLY
 * enriched reply (same shape as findReplyById / findByTerminalEchoId
 * return — including file and user lookups) and includes it directly
 * in the `terminal_echo_reply:created` socket broadcast.
 *
 * This is a deliberate choice over the earlier "send just the id, let
 * every listening client fetch it separately" approach: since reply
 * data already exists in memory right after creation, broadcasting it
 * directly means every connected device gets everything it needs in
 * ONE event, with zero follow-up authenticated HTTP requests. Given
 * this app's replies are short voice clips (well under a minute) and
 * thread rooms are typically small, the payload stays lightweight,
 * and we avoid the "N devices = N redundant fetches for the exact
 * same data" problem entirely.
 *
 * IMPORTANT — WHY THE BROADCAST STEP HAS ITS OWN try/catch:
 * The reply is already successfully created and persisted the moment
 * TerminalEchoReplySvc.createReply() resolves. Everything AFTER that
 * (re-fetching the full reply for the socket payload, emitting the
 * event(s)) is a "nice to have for real-time" step, not something the
 * success of the request should depend on. If that broadcast step
 * were inside the SAME try/catch as creation, any failure there
 * (e.g. a hiccup in the enrichment aggregation) would incorrectly
 * return a 500 to the client — making a reply that was actually saved
 * successfully LOOK like it failed to send. Splitting them means a
 * broadcast failure just logs a warning and silently skips real-time
 * delivery for that one reply, while the client still gets its
 * expected 201 success response.
 *
 * TWO SEPARATE BROADCASTS ON REPLY CREATION:
 * 1. `terminal_echo_reply:created` — sent ONLY to clients currently
 *    joined to this specific thread's room (`thread:<id>`). Carries
 *    the full reply object, since only people actively viewing this
 *    thread need to render its content.
 * 2. `terminal_echo:reply_added` — sent to EVERY connected client in
 *    the whole namespace, regardless of which (if any) thread they
 *    have open. Carries only the echo's id. This exists specifically
 *    so that reply counts shown on feed cards and map markers update
 *    live for people who are NOT currently inside the thread — e.g.
 *    someone browsing the feed or looking at the map. Without this,
 *    a reply's count would only ever refresh for those users the next
 *    time some UNRELATED full refetch happened to occur (which is
 *    what caused the earlier bug where a reply count only updated
 *    after posting a completely different new echo).
 */

import { Request, Response } from "express";
import Joi from "joi";
import TerminalEchoReplySvc from "../services/terminal.echo.reply.service";
import { io } from "../app";

export default class TerminalEchoReplyCtrl {
  // POST /terminal-echo-reply
  static async create(req: Request, res: Response) {
    const userId = req.user?.userId as string;

    const { terminalEchoId, fileUrl, fileName, textMessage, audioDuration, waveformData } = req.body;

    const schema = Joi.object({
      terminalEchoId: Joi.string().hex().length(24).required(),
      fileUrl: Joi.string().uri().optional().allow(""),
      fileName: Joi.string().optional().allow(""),
      textMessage: Joi.string().optional().allow(""),
      audioDuration: Joi.number().optional().default(0),
      waveformData: Joi.array().items(Joi.number()).optional().default([]),
    });

    const { error, value } = schema.validate({
      terminalEchoId,
      fileUrl: fileUrl || "",
      fileName: fileName || "",
      textMessage: textMessage || "",
      audioDuration: audioDuration || 0,
      waveformData: waveformData || [],
    });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    // Require either a file or a text message
    if (!value.fileUrl && !value.textMessage) {
      return res.status(400).json({ message: "Either fileUrl or textMessage is required." });
    }

    // ── Step 1: Create the reply. If THIS fails, the request should
    // genuinely fail — the reply was never saved. ──
    let result: any;
    try {
      result = await TerminalEchoReplySvc.createReply({
        userId,
        terminalEchoId: value.terminalEchoId,
        fileUrl: value.fileUrl,
        fileName: value.fileName,
        textMessage: value.textMessage,
        audioDuration: value.audioDuration,
        waveformData: value.waveformData,
      });
    } catch (err: any) {
      return res
        .status(500)
        .json({ message: err.message || "Server error." });
    }

    // ── Step 2: Build and emit the real-time broadcasts. This is
    // best-effort — if ANYTHING here fails, we log it and move on.
    // The reply already exists in the database at this point, so the
    // client's request should still be reported as a success; other
    // connected clients will simply pick up this reply the next time
    // they load/refresh the thread instead of via real-time push. ──
    try {
      const fullReply = await TerminalEchoReplySvc.findReplyById(
        result.insertedId.toString(),
        userId
      );

      // Targeted broadcast: only clients currently viewing THIS exact
      // thread need the full reply content.
      io.of("/terminal-echo").to(`thread:${value.terminalEchoId}`).emit("terminal_echo_reply:created", {
        terminalEchoId: value.terminalEchoId,
        reply: fullReply,
      });

      // Broad broadcast: every connected client (feed, map, wherever)
      // needs to know this echo's reply count went up, even if they're
      // not viewing the thread itself. Deliberately minimal payload —
      // just the echo id — since receivers only need to surgically
      // bump a counter, not render any reply content.
      io.of("/terminal-echo").emit("terminal_echo:reply_added", {
        terminalEchoId: value.terminalEchoId,
      });
    } catch (broadcastErr: any) {
      console.warn(
        "[TerminalEchoReplyCtrl.create] Reply saved successfully, but real-time broadcast failed:",
        broadcastErr
      );
      // Intentionally NOT rethrown — the reply itself was created
      // fine; only the "notify everyone live" step failed.
    }

    return res.status(201).json({
      message: "Terminal echo reply created.",
      insertedId: result.insertedId,
    });
  }

  // GET /terminal-echo-reply?terminalEchoId=<id>
  // Fetches ALL replies for a thread — used for the initial full load
  // when a thread screen first mounts.
  static async getByTerminalEchoId(req: Request, res: Response) {
    const { terminalEchoId } = req.query;

    const schema = Joi.object({
      terminalEchoId: Joi.string().hex().length(24).required(),
    });

    const { error, value } = schema.validate({ terminalEchoId });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const userId = req.user?.userId as string | undefined;
      const replies = await TerminalEchoReplySvc.findByTerminalEchoId(
        value.terminalEchoId as string,
        userId
      );
      return res.json({ data: replies });
    } catch (err: any) {
      return res
        .status(500)
        .json({ message: err.message || "Server error." });
    }
  }

  // GET /terminal-echo-reply/:id
  // Kept as a general-purpose single-reply fetch endpoint (still
  // useful for things like deep-linking to a specific reply, or a
  // manual reconciliation fallback), even though the primary real-time
  // "new reply" flow no longer depends on it — that flow now gets full
  // data directly via the socket payload above instead.
  static async getById(req: Request, res: Response) {
    const { id } = req.params;

    const schema = Joi.object({
      id: Joi.string().hex().length(24).required(),
    });

    const { error, value } = schema.validate({ id });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const userId = req.user?.userId as string | undefined;
      const reply = await TerminalEchoReplySvc.findReplyById(value.id, userId);
      if (!reply) {
        return res.status(404).json({ message: "Reply not found." });
      }
      return res.json({ data: reply });
    } catch (err: any) {
      return res
        .status(500)
        .json({ message: err.message || "Server error." });
    }
  }

  // PATCH /terminal-echo-reply/:id/listen
  static async incrementListen(req: Request, res: Response) {
    const { id } = req.params;

    const schema = Joi.object({
      id: Joi.string().hex().length(24).required(),
    });

    const { error, value } = schema.validate({ id });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const result = await TerminalEchoReplySvc.incrementListen(value.id);
      return res.json({ data: result?.value ?? null });
    } catch (err: any) {
      return res
        .status(500)
        .json({ message: err.message || "Server error." });
    }
  }

  // PATCH /terminal-echo-reply/:id/reaction
  static async updateReaction(req: Request, res: Response) {
    const userId = req.user?.userId as string;

    const { id } = req.params;
    const { reaction } = req.body;

    const schema = Joi.object({
      id: Joi.string().hex().length(24).required(),
      reaction: Joi.string()
        .valid("like", "love", "haha", "wow", "sad", "angry")
        .required(),
    });

    const { error, value } = schema.validate({ id, reaction });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    let result: any;
    try {
      result = await TerminalEchoReplySvc.updateReaction({
        replyId: value.id,
        reaction: value.reaction,
        userId,
      });
    } catch (err: any) {
      return res
        .status(500)
        .json({ message: err.message || "Server error." });
    }

    try {
      const terminalEchoId = result?.value?.terminalEchoId?.toString();

      if (terminalEchoId) {
        io.of("/terminal-echo").to(`thread:${terminalEchoId}`).emit("terminal_echo_reply:reaction_updated", {
          replyId: value.id,
          reactionKey: value.reaction,
          action: result?.action ?? "increment",
          triggeredByUserId: userId,
        });
      }
    } catch (broadcastErr: any) {
      console.warn(
        "[TerminalEchoReplyCtrl.updateReaction] Reaction saved, but broadcast failed:",
        broadcastErr
      );
    }

    return res.json({ data: result?.value ?? null });
  }
}