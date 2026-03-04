import { Request, Response } from "express";
import Joi from "joi";
import TerminalEchoReplySvc from "../services/terminal.echo.reply.service";

export default class TerminalEchoReplyCtrl {
  // POST /terminal-echo-reply
  static async create(req: Request, res: Response) {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { terminalEchoId, fileUrl, fileName } = req.body;

    const schema = Joi.object({
      terminalEchoId: Joi.string().hex().length(24).required(),
      fileUrl: Joi.string().uri().required(),
      fileName: Joi.string().min(1).required(),
    });

    const { error, value } = schema.validate({
      terminalEchoId,
      fileUrl,
      fileName,
    });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const result = await TerminalEchoReplySvc.createReply({
        userId,
        terminalEchoId: value.terminalEchoId,
        fileUrl: value.fileUrl,
        fileName: value.fileName,
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
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

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

