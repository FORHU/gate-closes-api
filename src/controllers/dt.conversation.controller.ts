import { Request, Response } from "express";
import Joi from "joi";
import DtConversationSvc from "../services/dt.conversation.service";
import { io } from "../app";
import {
  DT_SOCKET_EVENT,
  TDtConversationReadStateSocketPayload,
} from "../const";
import { getErrorMessage } from "../utils/error.util";

export default class DtConversationCtrl {

    static async createOrGetDm(req: Request, res: Response) {
        const userId = req.user?.userId as string;

        const { otherUserId } = req.body;

        const schema = Joi.object({
            otherUserId: Joi.string().required(),
        });

        const { error, value } = schema.validate({ otherUserId });
        if (error) return res.status(400).json({ message: error.message });

        try {
            const convo = await DtConversationSvc.createDmForUsers({
                requesterId: userId,
                otherUserId: value.otherUserId,
            });

            const participants = convo?.participants ?? [];
            for (const participantId of participants) {
                const participantIdStr = String(participantId);
                const conversationForParticipant =
                    await DtConversationSvc.getConversationDetailForUser({
                        conversationId: String(convo?._id),
                        requesterId: participantIdStr,
                    });

                io
                    .of("/dt")
                    .to(`user:${participantIdStr}`)
                    .emit("dt:new_conversation", conversationForParticipant ?? convo);
            }

            return res.json({ data: convo });
        } catch (err) {
            const message = getErrorMessage(err);
                return res.status(409).json({ message });
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
            const result = await DtConversationSvc.checkExistingDmForUsers({
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
            const conversations = await DtConversationSvc.listMyConversationsForUser(
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
            const conversations = await DtConversationSvc.searchConversationsForUser(
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
            const conversation = await DtConversationSvc.getConversationDetailForUser({
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

    static async markRead(req: Request, res: Response) {
        const userId = req.user?.userId as string;
        const conversationId = req.params.conversationId as string;

        const schema = Joi.object({
            conversationId: Joi.string().required(),
        });
        const { error, value } = schema.validate({ conversationId });
        if (error) return res.status(400).json({ message: error.message });

        try {
            const readState = await DtConversationSvc.markConversationReadForUser({
                conversationId: value.conversationId,
                requesterId: userId,
            });
            if (!readState) {
                return res.status(404).json({ message: "Conversation not found." });
            }

            const payload: TDtConversationReadStateSocketPayload = {
                kind: "read",
                conversationId: String(readState.conversationId),
                userId,
                serverTs: new Date().toISOString(),
                lastReadAt: readState.lastReadAt,
                hasUnread: false,
            };
            io
                .of("/dt")
                .to(`user:${userId}`)
                .emit(DT_SOCKET_EVENT.CONVERSATION_READ_STATE_UPDATED, payload);

            return res.json({ data: readState });
        } catch (err) {
            const message = getErrorMessage(err);
                return res.status(403).json({ message });
            return res.status(500).json({ message });
        }
    }
}
