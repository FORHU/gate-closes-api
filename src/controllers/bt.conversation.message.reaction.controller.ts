import { Request, Response } from "express";
import Joi from "joi";
import FlightTicketRepo from "../repositories/flight.ticket.repository";
import BtConversationRepo from "../repositories/bt.conversation.repository";
import BtConversationMessageReactionSvc from "../services/bt.conversation.message.reaction.service";
import BtConversationMessageSvc from "../services/bt.conversation.message.service";
import { io } from "../app";
import { ERROR_MESSAGE } from "../const";

export default class BtConversationMessageReactionCtrl{
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
      const btConversationId = BtConversationRepo.parseObjectId(
        value.conversationId,
        ERROR_MESSAGE.INVALID_CONVERSATION_ID
      );
  
      const convo = await BtConversationRepo.collection().findOne({
        _id: btConversationId,
        participants: requesterId,
      });
      if (!convo) {
        return res.status(403).json({ message: "Not a participant." });
      }
  
      const result = await BtConversationMessageReactionSvc.updateMessageReaction({
        btConversationMessageId: value.messageId,
        reaction: value.reaction,
        userId: requesterId,
      });
      
      const [updatedMessage] = await BtConversationMessageSvc.listMessages({
        btConversationId,
        limit: 1,
        requesterId,
      });
  
      if (updatedMessage) {
        io
          .of("/bt")
          .to(value.conversationId)
          .emit("bt:message_reaction_updated", updatedMessage);
      }
  
      return res.json({ data: result?.value ?? null });
    } catch (err: any) {
      return res.status(500).json({ message: err?.message ?? err });
    }
  }
}