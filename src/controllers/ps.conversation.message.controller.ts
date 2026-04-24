import { Request, Response } from "express";
import Joi from "joi";
import FlightTicketRepo from "../repositories/flight.ticket.repository";
import PsConversationRepo from "../repositories/ps.conversation.repository";
import PsConversationMessageSvc from "../services/ps.conversation.message.service";
import PsConversationSvc from "../services/ps.conversation.service";
import { io } from "../app";
import { ERROR_MESSAGE } from "../const";

export default class PsConversationMessageCtrl {

  // POST /conversations/:conversationId/messages - Send a message in parallel soul conversation
  static async send(req: Request, res: Response) {
    const userId = req.user?.userId as string;

    const { fileUrl, fileName } = req.body;
    const conversationId = req.params.conversationId as string;

    const schema = Joi.object({
      conversationId: Joi.string().required(),
      fileUrl: Joi.string().uri().required(),
      fileName: Joi.string().min(1).required(),
    });

    const { error, value } = schema.validate({ conversationId, fileUrl, fileName });
    if (error) return res.status(400).json({ message: error.message });

    try {
      const senderId = FlightTicketRepo.parseObjectId(
        userId,
        ERROR_MESSAGE.INVALID_USER_ID
      );
      const psConversationId = PsConversationRepo.parseObjectId(
        value.conversationId,
        ERROR_MESSAGE.INVALID_CONVERSATION_ID
      );

      const convo = await PsConversationRepo.collection().findOne({
        _id: psConversationId,
        participants: senderId,
      });
      if (!convo) {
        return res.status(403).json({ message: "Not a participant." });
      }

      const result = await PsConversationMessageSvc.sendMessage({
        psConversationId,
        psSenderId: senderId,
        fileUrl: value.fileUrl,
        fileName: value.fileName,
      });

      // Fetch the latest message (including file and sender lookups)
      const [latestMessage] = await PsConversationMessageSvc.listMessages({
        psConversationId,
        limit: 1,
      });

      // Realtime update for both participants in this conversation room
      if (latestMessage) {
        io.of("/ps").to(value.conversationId).emit("ps:new_message", latestMessage);
      }

      return res.json({ message: result });
    } catch (err: any) {
      return res.status(500).json({ message: err?.message ?? err });
    }
  }

  // GET /conversations/:conversationId/messages - Get all the sended messages in a conversation
  static async list(req: Request, res: Response) {
    const userId = req.user?.userId as string;

    const conversationId = req.params.conversationId as string;
    const { limit } = req.query;

    const schema = Joi.object({
      conversationId: Joi.string().required(),
      limit: Joi.number().integer().min(1).max(200).default(50),
    });

    const { error, value } = schema.validate(
      { conversationId, limit: limit !== undefined ? Number(limit) : undefined },
      { convert: true }
    );
    if (error) return res.status(400).json({ message: error.message });

    try {
      const requesterId = FlightTicketRepo.parseObjectId(
        userId,
        ERROR_MESSAGE.INVALID_USER_ID
      );
      const psConversationId = PsConversationRepo.parseObjectId(
        value.conversationId,
        ERROR_MESSAGE.INVALID_CONVERSATION_ID
      );

      const convo = await PsConversationRepo.collection().findOne({
        _id: psConversationId,
        participants: requesterId,
      });
      if (!convo) {
        return res.status(403).json({ message: "Not a participant." });
      }

      const messages = await PsConversationMessageSvc.listMessages({
        psConversationId,
        limit: value.limit,
        requesterId,
      });

      return res.json({ data: messages });
    } catch (err: any) {
      return res.status(500).json({ message: err?.message ?? err });
    }
  }
}
