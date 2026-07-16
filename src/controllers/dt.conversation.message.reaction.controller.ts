import { Request, Response } from "express";
import Joi from "joi";
import FlightTicketRepo from "../repositories/flight.ticket.repository";
import DtConversationRepo from "../repositories/dt.conversation.repository";
import DtConversationMessageReactionSvc from "../services/dt.conversation.message.reaction.service";
import DtConversationMessageSvc from "../services/dt.conversation.message.service";
import DtConversationSvc from "../services/dt.conversation.service";
import { io } from "../app";
import {
  ERROR_MESSAGE,
  DT_SOCKET_EVENT,
  TDtConversationReadStateSocketPayload,
} from "../const";

export default class DtConversationMessageReactionCtrl {
  static async updateReaction(req: Request, res: Response) {
    const userId = req.user?.userId as string;

    const conversationId = req.params.conversationId as string;
    const messageId = req.params.messageId as string;
    const { reaction } = req.body;

    const schema = Joi.object({
      conversationId: Joi.string().required(),
      messageId: Joi.string().hex().length(24).required(),
      reaction: Joi.string()
        .valid("like", "love", "haha", "wow", "sad", "angry")
        .required(),
    });

    const { error, value } = schema.validate({
      conversationId,
      messageId,
      reaction,
    });
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

      const result = await DtConversationMessageReactionSvc.updateMessageReaction({
        dtConversationMessageId: value.messageId,
        reaction: value.reaction,
        userId: requesterId,
      });

      await DtConversationSvc.refreshConversationLatestEvent({
        conversationId: dtConversationId,
        type: result.eventType,
        actorId: requesterId,
        payload: {
          messageId: value.messageId,
          reaction: value.reaction,
        },
      });

      const participants = (convo as any)?.participants ?? [];
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

      const updatedMessage = await DtConversationMessageSvc.getMessageById({
        dtConversationMessageId: value.messageId,
        requesterId,
      });

      if (updatedMessage) {
        io
          .of("/dt")
          .to(value.conversationId)
          .emit("dt:message_reaction_updated", updatedMessage);
      }

      return res.json({ data: result?.messageUpdate?.value ?? null });
    } catch (err: any) {
      return res.status(500).json({ message: err?.message ?? err });
    }
  }
}
