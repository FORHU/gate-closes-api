import { Request, Response } from "express";
import Joi from "joi";
import DtConversationSvc from "../services/dt.conversation.service";
import { io } from "../app";
import {
  ERROR_MESSAGE,
  DT_SOCKET_EVENT,
  TDtConversationReadStateSocketPayload,
} from "../const";

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

            const participants = (convo as any)?.participants ?? [];
            for (const participantId of participants) {
                const participantIdStr = String(participantId);
                const conversationForParticipant =
                    await DtConversationSvc.getConversationDetailForUser({
                        conversationId: String((convo as any)._id),
                        requesterId: participantIdStr,
                    });

                io
                    .of("/dt")
                    .to(`user:${participantIdStr}`)
                    .emit("dt:new_conversation", conversationForParticipant ?? convo);
            }

            return res.json({ data: convo });
        } catch (err: any) {
            if (err?.message === "Conversation already exists.") {
                return res.status(409).json({ message: err.message });
            }
            return res.status(400).json({ message: err?.message ?? err });
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
        } catch (err: any) {
            return res.status(400).json({ message: err?.message ?? err });
        }
    }

    static async listMyConversations(req: Request, res: Response) {
        const userId = req.user?.userId as string;

        try {
            const conversations = await DtConversationSvc.listMyConversationsForUser(
                userId
            );
            return res.json({ data: conversations });
        } catch (err: any) {
            return res.status(500).json({ message: err?.message ?? err });
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
        } catch (err: any) {
            if (err?.message === "Not a participant.") {
                return res.status(403).json({ message: err.message });
            }
            return res.status(500).json({ message: err?.message ?? err });
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
        } catch (err: any) {
            if (err?.message === "Not a participant.") {
                return res.status(403).json({ message: err.message });
            }
            return res.status(500).json({ message: err?.message ?? err });
        }
    }
}
