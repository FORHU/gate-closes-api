import { Request, Response } from "express";
import Joi from "joi";
import FlightTicketRepo from "../repositories/flight.ticket.repository";
import PsConversationRepo from "../repositories/ps.conversation.repository";
import PsConversationMessageReactionSvc from "../services/ps.conversation.message.reaction.service";
import PsConversationMessageSvc from "../services/ps.conversation.message.service";
import { io } from "../app";
import { ERROR_MESSAGE } from "../const";

export default class PsConversationMessageReactionCtrl {

  // PATCH /conversations/:conversationId/messages/:messageId/reaction - update the reaction data when user react in one of the messages
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

      const result = await PsConversationMessageReactionSvc.updateMessageReaction({
        psConversationMessageId: value.messageId,
        reaction: value.reaction,
        userId: requesterId,
      });

      const updatedMessage = await PsConversationMessageSvc.getMessageById({
        psConversationMessageId: value.messageId,
        requesterId,
      });

      if (updatedMessage) {
        io
          .of("/ps")
          .to(value.conversationId)
          .emit("ps:message_reaction_updated", updatedMessage);
      }

      return res.json({ data: result?.value ?? null });
    } catch (err: any) {
      return res.status(500).json({ message: err?.message ?? err });
    }
  }
}
