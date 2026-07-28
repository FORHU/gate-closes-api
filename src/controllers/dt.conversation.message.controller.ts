import { Request, Response } from "express";
import Joi from "joi";
import FlightTicketRepo from "../repositories/flight.ticket.repository";
import DtConversationRepo from "../repositories/dt.conversation.repository";
import DtConversationMessageSvc from "../services/dt.conversation.message.service";
import DtConversationSvc from "../services/dt.conversation.service";
import { io } from "../app";
import {
  ERROR_MESSAGE,
  DT_SOCKET_EVENT,
  TDtConversationReadStateSocketPayload,
} from "../const";
import { getErrorMessage } from "../utils/error.util";

export default class DtConversationMessageCtrl {

  static async send(req: Request, res: Response) {
    const userId = req.user?.userId as string;

    const { fileUrl, fileName, audioDuration, waveformData } = req.body;
    const conversationId = req.params.conversationId as string;

    const schema = Joi.object({
      conversationId: Joi.string().required(),
      fileUrl: Joi.string().uri().required(),
      fileName: Joi.string().min(1).required(),
      audioDuration: Joi.number().optional().default(0),
      waveformData: Joi.array().items(Joi.number()).optional().default([]),
    });

    const { error, value } = schema.validate({ conversationId, fileUrl, fileName, audioDuration, waveformData });
    if (error) return res.status(400).json({ message: error.message });

    try {
      const senderId = FlightTicketRepo.parseObjectId(
        userId,
        ERROR_MESSAGE.INVALID_USER_ID
      );
      const dtConversationId = DtConversationRepo.parseObjectId(
        value.conversationId,
        ERROR_MESSAGE.INVALID_CONVERSATION_ID
      );

      const convo = await DtConversationRepo.collection().findOne({
        _id: dtConversationId,
        participants: senderId,
      });
      if (!convo) {
        return res.status(403).json({ message: "Not a participant." });
      }

      const result = await DtConversationMessageSvc.sendMessage({
        dtConversationId,
        dtSenderId: senderId,
        fileUrl: value.fileUrl,
        fileName: value.fileName,
        audioDuration: value.audioDuration,
        waveformData: value.waveformData,
      });

      await DtConversationSvc.refreshConversationLatestEvent({
        conversationId: dtConversationId,
        type: "message_sent",
        actorId: senderId,
        payload: {
          messageId: result.insertedId,
          fileName: value.fileName,
        },
      });

      const participants = convo?.participants ?? [];
      for (const participantId of participants) {
        const participantObjectId = FlightTicketRepo.parseObjectId(
          String(participantId),
          ERROR_MESSAGE.INVALID_USER_ID
        );
        const participantRealtimeState =
          await DtConversationSvc.getConversationRealtimeStateForUser({
            conversationId: dtConversationId,
            requesterId: participantObjectId,
          });
        if (!participantRealtimeState) continue;

        const payload: TDtConversationReadStateSocketPayload = {
          kind: "latest_event",
          conversationId: participantRealtimeState.conversationId,
          userId: participantRealtimeState.userId,
          serverTs: new Date().toISOString(),
          lastEventAt: participantRealtimeState.lastEventAt,
          lastEventActorId: participantRealtimeState.lastEventActorId,
          lastEventType: participantRealtimeState.lastEventType,
          lastEventText: participantRealtimeState.lastEventText,
          hasUnread: participantRealtimeState.hasUnread,
        };
        io
          .of("/dt")
          .to(`user:${participantRealtimeState.userId}`)
          .emit(DT_SOCKET_EVENT.CONVERSATION_READ_STATE_UPDATED, payload);
      }

      const [latestMessage] = await DtConversationMessageSvc.listMessages({
        dtConversationId,
        limit: 1,
      });

      if (latestMessage) {
        io.of("/dt").to(value.conversationId).emit("dt:new_message", latestMessage);
      }

      return res.json({ message: result });
    } catch (err) {
      return res.status(500).json({ message: getErrorMessage(err) });
    }
  }

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
      const dtConversationId = DtConversationRepo.parseObjectId(
        value.conversationId,
        ERROR_MESSAGE.INVALID_CONVERSATION_ID
      );

      const convo = await DtConversationRepo.collection().findOne({
        _id: dtConversationId,
        participants: requesterId,
      });
      if (!convo) {
        return res.status(403).json({ message: "Not a participant." });
      }

      const messages = await DtConversationMessageSvc.listMessages({
        dtConversationId,
        limit: value.limit,
        requesterId,
      });

      return res.json({ data: messages });
    } catch (err) {
      return res.status(500).json({ message: getErrorMessage(err) });
    }
  }
}
