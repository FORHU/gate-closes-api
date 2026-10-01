import { Request, Response } from "express";
import Joi from "joi";
import ConversationSvc from "../services/conversation.service";
import ConversationRepo from "../repositories/conversation.repository";
import { ERROR_MESSAGE } from "../const";
import { getErrorMessage } from "../utils/error.util";
import { ConversationType } from "../domain/conversation/conversation.types";
import { io } from "../app";

/**
 * Tells every participant's personal `user:<id>` room (joined on connect in
 * conversation.events.ts) that a conversation's latest event changed, so
 * connection lists refresh without the user having that thread open.
 */
function notifyParticipants(
  conversation: { _id?: unknown; participants?: unknown[] } | null | undefined
): void {
  if (!conversation?.participants?.length) return;
  const nsp = io.of("/conversations");
  const payload = { conversationId: String(conversation._id) };
  for (const participantId of conversation.participants) {
    nsp.to(`user:${String(participantId)}`).emit("conversation:updated", payload);
  }
}

export default class ConversationCtrl {
  static async create(req: Request, res: Response) {
    const userId = req.user?.userId as string;
    const { type, otherUserId } = req.body;

    const schema = Joi.object({
      type: Joi.string().valid("parallel_soul", "destination_thread", "baton_touch").required(),
      otherUserId: Joi.string().hex().length(24).required(),
    });

    const { error, value } = schema.validate({ type, otherUserId });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const requesterId = ConversationRepo.parseObjectId(userId, ERROR_MESSAGE.INVALID_USER_ID);
      const otherUserObjectId = ConversationRepo.parseObjectId(
        value.otherUserId,
        ERROR_MESSAGE.INVALID_OTHER_USER_ID
      );

      const conversation = await ConversationSvc.createDm({
        type: value.type as ConversationType,
        requesterId,
        otherUserId: otherUserObjectId,
      });

      return res.status(201).json({ data: conversation });
    } catch (err) {
      const message = getErrorMessage(err);
      if (message === "Conversation already exists.") {
        return res.status(409).json({ message });
      }
      return res.status(400).json({ message });
    }
  }

  static async list(req: Request, res: Response) {
    const userId = req.user?.userId as string;
    const type = req.query.type as ConversationType | undefined;

    try {
      const userObjectId = ConversationRepo.parseObjectId(userId, ERROR_MESSAGE.INVALID_USER_ID);

      const conversations = await ConversationSvc.listMyConversations(userObjectId, type);
      return res.json({ data: conversations });
    } catch (err) {
      return res.status(500).json({ message: getErrorMessage(err) });
    }
  }

  static async search(req: Request, res: Response) {
    const userId = req.user?.userId as string;
    const q = (req.query.q as string) || "";
    const type = req.query.type as ConversationType | undefined;

    try {
      const userObjectId = ConversationRepo.parseObjectId(userId, ERROR_MESSAGE.INVALID_USER_ID);

      const conversations = await ConversationSvc.searchMyConversations(userObjectId, q, type);
      return res.json({ data: conversations });
    } catch (err) {
      return res.status(500).json({ message: getErrorMessage(err) });
    }
  }

  static async getById(req: Request, res: Response) {
    const userId = req.user?.userId as string;
    const { conversationId } = req.params;

    try {
      const userObjectId = ConversationRepo.parseObjectId(userId, ERROR_MESSAGE.INVALID_USER_ID);
      const convoObjectId = ConversationRepo.parseObjectId(
        conversationId,
        "Invalid conversation ID"
      );

      const conversation = await ConversationSvc.getById(convoObjectId, userObjectId);

      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      return res.json({ data: conversation });
    } catch (err) {
      return res.status(500).json({ message: getErrorMessage(err) });
    }
  }

  static async markRead(req: Request, res: Response) {
    const userId = req.user?.userId as string;
    const { conversationId } = req.params;

    try {
      const userObjectId = ConversationRepo.parseObjectId(userId, ERROR_MESSAGE.INVALID_USER_ID);
      const convoObjectId = ConversationRepo.parseObjectId(
        conversationId,
        "Invalid conversation ID"
      );

      const result = await ConversationSvc.markConversationRead({
        conversationId: convoObjectId,
        userId: userObjectId,
      });

      return res.json({ data: result });
    } catch (err) {
      return res.status(500).json({ message: getErrorMessage(err) });
    }
  }

  static async checkDmExists(req: Request, res: Response) {
    const userId = req.user?.userId as string;
    const { type, otherUserId } = req.query;

    const schema = Joi.object({
      type: Joi.string().valid("parallel_soul", "destination_thread", "baton_touch").required(),
      otherUserId: Joi.string().hex().length(24).required(),
    });

    const { error, value } = schema.validate({ type, otherUserId });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const userObjectId = ConversationRepo.parseObjectId(userId, ERROR_MESSAGE.INVALID_USER_ID);
      const otherUserObjectId = ConversationRepo.parseObjectId(
        value.otherUserId,
        ERROR_MESSAGE.INVALID_OTHER_USER_ID
      );

      const { exists, conversationId } = await ConversationSvc.checkDmExists({
        type: value.type as ConversationType,
        userId: userObjectId,
        otherUserId: otherUserObjectId,
      });

      return res.json({ exists, conversationId });
    } catch (err) {
      return res.status(500).json({ message: getErrorMessage(err) });
    }
  }

  static async sendMessage(req: Request, res: Response) {
    const userId = req.user?.userId as string;
    const { conversationId } = req.params;
    const { fileUrl, fileName, textMessage, audioDuration, waveformData } = req.body;

    const schema = Joi.object({
      fileUrl: Joi.string().uri().optional(),
      fileName: Joi.string().optional(),
      textMessage: Joi.string().optional().allow(""),
      audioDuration: Joi.number().optional().default(0),
      waveformData: Joi.array().items(Joi.number()).optional().default([]),
    }).or("fileUrl", "textMessage");

    const { error, value } = schema.validate({
      fileUrl,
      fileName,
      textMessage,
      audioDuration,
      waveformData,
    });
    if (error) return res.status(400).json({ message: error.message });

    try {
      const senderId = ConversationRepo.parseObjectId(userId, ERROR_MESSAGE.INVALID_USER_ID);
      const convoObjectId = ConversationRepo.parseObjectId(
        conversationId,
        "Invalid conversation ID"
      );

      const result = await ConversationSvc.sendMessage({
        conversationId: convoObjectId,
        senderId,
        textMessage: value.textMessage,
        fileUrl: value.fileUrl,
        fileName: value.fileName,
        audioDuration: value.audioDuration,
        waveformData: value.waveformData,
      });

      try {
        io.of("/conversations").to(conversationId).emit("message:received", result.message);
        notifyParticipants(result.conversation);
      } catch (err) {
        console.warn("[ConversationCtrl.sendMessage] Broadcast warning:", err);
      }

      return res.status(201).json({ data: result.message });
    } catch (err) {
      const message = String(getErrorMessage(err));
      const status = message.includes("Not a participant") ? 403 : 500;
      return res.status(status).json({ message });
    }
  }

  static async listMessages(req: Request, res: Response) {
    const userId = req.user?.userId as string;
    const { conversationId } = req.params;
    const limit = Number(req.query.limit) || 50;

    try {
      const userObjectId = ConversationRepo.parseObjectId(userId, ERROR_MESSAGE.INVALID_USER_ID);
      const convoObjectId = ConversationRepo.parseObjectId(
        conversationId,
        "Invalid conversation ID"
      );

      const messages = await ConversationSvc.listMessages({
        conversationId: convoObjectId,
        userId: userObjectId,
        limit,
      });

      return res.json({ data: messages });
    } catch (err) {
      const message = String(getErrorMessage(err));
      const status = message.includes("Not a participant") ? 403 : 500;
      return res.status(status).json({ message });
    }
  }

  static async updateReaction(req: Request, res: Response) {
    const userId = req.user?.userId as string;
    const { conversationId, messageId } = req.params;
    const { reaction } = req.body;

    const schema = Joi.object({
      reaction: Joi.string().valid("like", "love", "haha", "wow", "sad", "angry").required(),
    });
    const { error, value } = schema.validate({ reaction });
    if (error) return res.status(400).json({ message: error.message });

    try {
      const userObjectId = ConversationRepo.parseObjectId(userId, ERROR_MESSAGE.INVALID_USER_ID);
      const convoObjectId = ConversationRepo.parseObjectId(
        conversationId,
        "Invalid conversation ID"
      );
      const msgObjectId = ConversationRepo.parseObjectId(messageId, "Invalid message ID");

      const result = await ConversationSvc.updateMessageReaction({
        conversationId: convoObjectId,
        messageId: msgObjectId,
        userId: userObjectId,
        reaction: value.reaction,
      });

      try {
        io.of("/conversations").to(conversationId).emit("reaction:updated", result);
        notifyParticipants(result.conversation);
      } catch (err) {
        console.warn("[ConversationCtrl.updateReaction] Broadcast warning:", err);
      }

      return res.json({ data: result });
    } catch (err) {
      const message = String(getErrorMessage(err));
      const status = message.includes("Not a participant") ? 403 : 500;
      return res.status(status).json({ message });
    }
  }
}
