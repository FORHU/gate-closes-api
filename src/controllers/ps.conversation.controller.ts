import { Request, Response } from "express";
import Joi from "joi";
import PsConversationSvc from "../services/ps.conversation.service";

export default class PsConversationCtrl {
  // POST /conversations - Create a parallel soul conversation
  static async create(req: Request, res: Response) {
    const userId = req.user?.userId as string;

    const { otherUserId } = req.body;

    const schema = Joi.object({
      otherUserId: Joi.string().required(),
    });

    const { error, value } = schema.validate({ otherUserId });
    if (error) return res.status(400).json({ message: error.message });

    try {
      const convo = await PsConversationSvc.createDmForUsers({
        requesterId: userId,
        otherUserId: value.otherUserId,
      });

      return res.json({ data: convo });
    } catch (err: any) {
      if (err?.message === "Conversation already exists.") {
        return res.status(409).json({ message: err.message });
      }
      return res.status(400).json({ message: err?.message ?? err });
    }
  }

  // GET /conversations/dm/existence - Check whether conversation between users already exists
  static async checkDmExists(req: Request, res: Response) {
    const userId = req.user?.userId as string;
    const { otherUserId } = req.query;

    const schema = Joi.object({
      otherUserId: Joi.string().required(),
    });

    const { error, value } = schema.validate({ otherUserId });
    if (error) return res.status(400).json({ message: error.message });

    try {
      const result = await PsConversationSvc.checkExistingDmForUsers({
        requesterId: userId,
        otherUserId: value.otherUserId,
      });

      return res.json({ data: result });
    } catch (err: any) {
      return res.status(400).json({ message: err?.message ?? err });
    }
  }

  // GET /conversations - List all the parallel soul convo of auth user
  static async listMyConversations(req: Request, res: Response) {
    const userId = req.user?.userId as string;

    try {
      const conversations = await PsConversationSvc.listMyConversationsForUser(
        userId
      );
      return res.json({ data: conversations });
    } catch (err: any) {
      return res.status(500).json({ message: err?.message ?? err });
    }
  }

  // GET /conversations/:conversationId - Get conversation detail with participant data
  static async getById(req: Request, res: Response) {
    const userId = req.user?.userId as string;
    const conversationId = req.params.conversationId as string;

    const schema = Joi.object({
      conversationId: Joi.string().required(),
    });
    const { error, value } = schema.validate({ conversationId });
    if (error) return res.status(400).json({ message: error.message });

    try {
      const conversation = await PsConversationSvc.getConversationDetailForUser({
        conversationId: value.conversationId,
        requesterId: userId,
      });
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found." });
      }

      return res.json({
        data: conversation,
      });
    } catch (err: any) {
      if (err?.message === "Not a participant.") {
        return res.status(403).json({ message: err.message });
      }
      return res.status(500).json({ message: err?.message ?? err });
    }
  }
}

