/**
 * terminal.echo.reply.controller.ts
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

    try {
      const result = await TerminalEchoReplySvc.createReply({
        userId,
        terminalEchoId: value.terminalEchoId,
        fileUrl: value.fileUrl,
        fileName: value.fileName,
        textMessage: value.textMessage,
        audioDuration: value.audioDuration,
        waveformData: value.waveformData,
      });

      // Re-fetch the FULL enriched reply (file + user lookups already
      // baked in — same shape as any other reply the frontend already
      // knows how to map) so we can broadcast it whole, rather than
      // just its id. This costs one extra DB read on the backend, but
      // saves every connected client from having to make their own
      // follow-up authenticated request to get the same data.
      const fullReply = await TerminalEchoReplySvc.findReplyById(
        result.insertedId.toString(),
        userId
      );

      io.of("/terminal-echo").to(`thread:${value.terminalEchoId}`).emit("terminal_echo_reply:created", {
        terminalEchoId: value.terminalEchoId,
        reply: fullReply,
      });

      return res.status(201).json({
        message: "Terminal echo reply created.",
        insertedId: result.insertedId,
      });
    } catch (err: any) {
      return res
        .status(500)
        .json({ message: err.message || "Server error." });
    }
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

    try {
      const result = await TerminalEchoReplySvc.updateReaction({
        replyId: value.id,
        reaction: value.reaction,
        userId,
      });
      return res.json({ data: result?.value ?? null });
    } catch (err: any) {
      return res
        .status(500)
        .json({ message: err.message || "Server error." });
    }
  }
}