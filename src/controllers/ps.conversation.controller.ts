import { Request, Response } from "express";
import Joi from "joi";
import PsConversationSvc from "../services/ps.conversation.service";
import { io } from "../app";
import {
  PS_SOCKET_EVENT,
  TPsConversationReadStateSocketPayload,
} from "../const";
import { getErrorMessage } from "../utils/error.util";

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

      const participants = convo?.participants ?? [];
      for (const participantId of participants) {
        const participantIdStr = String(participantId);
        const conversationForParticipant =
          await PsConversationSvc.getConversationDetailForUser({
            conversationId: String(convo?._id),
            requesterId: participantIdStr,
          });

        io
          .of("/ps")
          .to(`user:${participantIdStr}`)
          .emit("ps:new_conversation", conversationForParticipant ?? convo);
      }

      return res.json({ data: convo });
    } catch (err) {
      const message = getErrorMessage(err);
        return res.status(409).json({ message });
      return res.status(400).json({ message });
    }
  }

  // GET /conversations/search?q=name - Search my conversations by the other participant's name
  static async searchMyConversations(req: Request, res: Response) {
    const userId = req.user?.userId as string;
    const { q } = req.query;

    const schema = Joi.object({
      q: Joi.string().trim().min(1).required(),
    });

    const { error, value } = schema.validate({ q });
    if (error) return res.status(400).json({ message: error.message });

    try {
      const conversations = await PsConversationSvc.searchConversationsForUser(
        userId,
        value.q
      );
      return res.json({ data: conversations });
    } catch (err) {
      return res.status(500).json({ message: getErrorMessage(err) });
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
    } catch (err) {
      return res.status(400).json({ message: getErrorMessage(err) });
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
    } catch (err) {
      return res.status(500).json({ message: getErrorMessage(err) });
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
    } catch (err) {
      const message = getErrorMessage(err);
        return res.status(403).json({ message });
      return res.status(500).json({ message });
    }
  }

  // POST /conversations/:conversationId/read - Mark conversation as read by auth user
  static async markRead(req: Request, res: Response) {
    const userId = req.user?.userId as string;
    const conversationId = req.params.conversationId as string;

    const schema = Joi.object({
      conversationId: Joi.string().required(),
    });
    const { error, value } = schema.validate({ conversationId });
    if (error) return res.status(400).json({ message: error.message });

    try {
      const readState = await PsConversationSvc.markConversationReadForUser({
        conversationId: value.conversationId,
        requesterId: userId,
      });
      if (!readState) {
        return res.status(404).json({ message: "Conversation not found." });
      }

      const payload: TPsConversationReadStateSocketPayload = {
        kind: "read",
        conversationId: String(readState.conversationId),
        userId,
        serverTs: new Date().toISOString(),
        lastReadAt: readState.lastReadAt,
        hasUnread: false,
      };
      io
        .of("/ps")
        .to(`user:${userId}`)
        .emit(PS_SOCKET_EVENT.CONVERSATION_READ_STATE_UPDATED, payload);

      return res.json({ data: readState });
    } catch (err) {
      const message = getErrorMessage(err);
        return res.status(403).json({ message });
      return res.status(500).json({ message });
    }
  }
}

