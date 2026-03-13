import { Request, Response } from "express";
import Joi from "joi";
import FlightTicketRepo from "../repositories/flight.ticket.repository";
import PsConversationRepo from "../repositories/ps.conversation.repository";
import PsConversationSvc from "../services/ps.conversation.service";
import { io } from "../app";

export default class PsConversationMessageCtrl {

  static async send(req: Request, res: Response) {
    const userId = req.user?.userId as string | undefined;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

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
      const senderId = FlightTicketRepo.parseObjectId(userId, "Invalid user id.");
      const psConversationId = PsConversationRepo.parseObjectId(
        value.conversationId,
        "Invalid conversation id."
      );

      const convo = await PsConversationRepo.collection().findOne({
        _id: psConversationId,
        participants: senderId,
      });
      if (!convo) {
        return res.status(403).json({ message: "Not a participant." });
      }

      const result = await PsConversationSvc.sendMessage({
        psConversationId,
        psSenderId: senderId,
        fileUrl: value.fileUrl,
        fileName: value.fileName,
      });

      // Fetch the latest message (including file and sender lookups)
      const [latestMessage] = await PsConversationSvc.listMessages({
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

  static async list(req: Request, res: Response) {
    const userId = req.user?.userId as string | undefined;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

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
      const requesterId = FlightTicketRepo.parseObjectId(userId, "Invalid user id.");
      const psConversationId = PsConversationRepo.parseObjectId(
        value.conversationId,
        "Invalid conversation id."
      );

      const convo = await PsConversationRepo.collection().findOne({
        _id: psConversationId,
        participants: requesterId,
      });
      if (!convo) {
        return res.status(403).json({ message: "Not a participant." });
      }

      const messages = await PsConversationSvc.listMessages({
        psConversationId,
        limit: value.limit,
      });

      return res.json({ data: messages });
    } catch (err: any) {
      return res.status(500).json({ message: err?.message ?? err });
    }
  }
}

