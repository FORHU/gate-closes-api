import { Request, Response } from "express";
import Joi from "joi";
import BtConversationSvc from "../services/bt.conversation.service";
import { io } from "../app";
import {
  BT_SOCKET_EVENT,
  TBtConversationReadStateSocketPayload,
} from "../const";
import { getErrorMessage } from "../utils/error.util";

export default class BtConversationCtrl {

    static async createOrGetDm(req: Request, res: Response) {
        const userId = req.user?.userId as string;

        const { otherUserId } = req.body;

        const schema = Joi.object({
            otherUserId: Joi.string().required(),
        });

        const { error, value } = schema.validate({ otherUserId });
        if (error) return res.status(400).json({ message: error.message });

        try {
            const convo = await BtConversationSvc.createDmForUsers({
                requesterId: userId,
                otherUserId: value.otherUserId,
            });

            const participants = convo?.participants ?? [];
            for (const participantId of participants) {
                const participantIdStr = String(participantId);
                const conversationForParticipant =
                    await BtConversationSvc.getConversationDetailForUser({
                        conversationId: String(convo?._id),
                        requesterId: participantIdStr,
                    });

                io
                    .of("/bt")
                    .to(`user:${participantIdStr}`)
                    .emit("bt:new_conversation", conversationForParticipant ?? convo);
            }

            return res.json({ data: convo });
        } catch (err) {
            const message = getErrorMessage(err);
            if (message === "Conversation already exists.") {
                return res.status(409).json({ message });
            }
            return res.status(400).json({ message });
        }
    }

    static async checkDmExists(req: Request, res: Response) {
        const userId = req.user?.userId as string;
        const { otherUserId } = req.query;

        const schema = Joi.object({
            otherUserId: Joi.string().required(),
        });

        const { error, value } = schema.validate({ otherUserId });
        if (error) return res.status(400).json({ message: error.message });

        try {
            const result = await BtConversationSvc.checkExistingDmForUsers({
                requesterId: userId,
                otherUserId: value.otherUserId,
            });

            return res.json({ data: result });
        } catch (err) {
            return res.status(400).json({ message: getErrorMessage(err) });
        }
    }

    static async listMyConversations(req: Request, res: Response) {
        const userId = req.user?.userId as string;

        try {
            const conversations = await BtConversationSvc.listMyConversationsForUser(
                userId
            );
            return res.json({ data: conversations });
        } catch (err) {
            return res.status(500).json({ message: getErrorMessage(err) });
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
            const conversations = await BtConversationSvc.searchConversationsForUser(
                userId,
                value.q
            );
            return res.json({ data: conversations });
        } catch (err) {
            return res.status(500).json({ message: getErrorMessage(err) });
        }
    }

    static async getById(req: Request, res: Response) {
        const userId = req.user?.userId as string;
        const conversationId = req.params.conversationId as string;

        const schema = Joi.object({
            conversationId: Joi.string().required(),
        });
        const { error, value } = schema.validate({ conversationId });
        if (error) return res.status(400).json({ message: error.message });

        try {
            const conversation = await BtConversationSvc.getConversationDetailForUser({
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
            if (message === "Not a participant.") {
                return res.status(403).json({ message });
            }
            return res.status(500).json({ message });
        }
    }

    static async markRead(req: Request, res: Response) {
        const userId = req.user?.userId as string;
        const conversationId = req.params.conversationId as string;

        const schema = Joi.object({
            conversationId: Joi.string().required(),
        });
        const { error, value } = schema.validate({ conversationId });
        if (error) return res.status(400).json({ message: error.message });

        try {
            const readState = await BtConversationSvc.markConversationReadForUser({
                conversationId: value.conversationId,
                requesterId: userId,
            });
            if (!readState) {
                return res.status(404).json({ message: "Conversation not found." });
            }

            const payload: TBtConversationReadStateSocketPayload = {
                kind: "read",
                conversationId: String(readState.conversationId),
                userId,
                serverTs: new Date().toISOString(),
                lastReadAt: readState.lastReadAt,
                hasUnread: false,
            };
            io
                .of("/bt")
                .to(`user:${userId}`)
                .emit(BT_SOCKET_EVENT.CONVERSATION_READ_STATE_UPDATED, payload);

            return res.json({ data: readState });
        } catch (err) {
            const message = getErrorMessage(err);
            if (message === "Not a participant.") {
                return res.status(403).json({ message });
            }
            return res.status(500).json({ message });
        }
    }
}
