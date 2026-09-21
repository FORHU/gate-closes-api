import { Request, Response } from "express";
import Joi from "joi";
import ConversationSvc from "../services/conversation.service";
import ConversationRepo from "../repositories/conversation.repository";
import { ERROR_MESSAGE } from "../const";
import { getErrorMessage } from "../utils/error.util";
import { ConversationType } from "../domain/conversation/conversation.types";

export default class ConversationCtrl {
  static async create(req: Request, res: Response) {
    const userId = req.user?.userId as string;
    const { type, otherUserId } = req.body;

    const schema = Joi.object({
      type: Joi.string()
        .valid("parallel_soul", "destination_thread", "baton_touch")
        .required(),
      otherUserId: Joi.string().hex().length(24).required(),
    });

    const { error, value } = schema.validate({ type, otherUserId });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const requesterId = ConversationRepo.parseObjectId(
        userId,
        ERROR_MESSAGE.INVALID_USER_ID
      );
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
      const userObjectId = ConversationRepo.parseObjectId(
        userId,
        ERROR_MESSAGE.INVALID_USER_ID
      );

      const conversations = await ConversationSvc.listMyConversations(
        userObjectId,
        type
      );
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
      const userObjectId = ConversationRepo.parseObjectId(
        userId,
        ERROR_MESSAGE.INVALID_USER_ID
      );

      const conversations = await ConversationSvc.searchMyConversations(
        userObjectId,
        q,
        type
      );
      return res.json({ data: conversations });
    } catch (err) {
      return res.status(500).json({ message: getErrorMessage(err) });
    }
  }

  static async getById(req: Request, res: Response) {
    const userId = req.user?.userId as string;
    const { conversationId } = req.params;

    try {
      const userObjectId = ConversationRepo.parseObjectId(
        userId,
        ERROR_MESSAGE.INVALID_USER_ID
      );
      const convoObjectId = ConversationRepo.parseObjectId(
        conversationId,
        "Invalid conversation ID"
      );

      const conversation = await ConversationSvc.getById(
        convoObjectId,
        userObjectId
      );

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
      const userObjectId = ConversationRepo.parseObjectId(
        userId,
        ERROR_MESSAGE.INVALID_USER_ID
      );
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
      type: Joi.string()
        .valid("parallel_soul", "destination_thread", "baton_touch")
        .required(),
      otherUserId: Joi.string().hex().length(24).required(),
    });

    const { error, value } = schema.validate({ type, otherUserId });
    if (error) {
      return res.status(400).json({ message: error.message });
    }

    try {
      const userObjectId = ConversationRepo.parseObjectId(
        userId,
        ERROR_MESSAGE.INVALID_USER_ID
      );
      const otherUserObjectId = ConversationRepo.parseObjectId(
        value.otherUserId,
        ERROR_MESSAGE.INVALID_OTHER_USER_ID
      );

      const exists = await ConversationSvc.checkDmExists({
        type: value.type as ConversationType,
        userId: userObjectId,
        otherUserId: otherUserObjectId,
      });

      return res.json({ exists });
    } catch (err) {
      return res.status(500).json({ message: getErrorMessage(err) });
    }
  }
}
