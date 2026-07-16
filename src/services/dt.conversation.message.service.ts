import { ObjectId } from "mongodb";
import DtConversationMessageRepo from "../repositories/dt.conversation.message.repository";
import DtConversationMessageReactionRepo from "../repositories/dt.conversation.message.reaction.repository";
import FileSvc from "./file.service";

export default class DtConversationMessageSvc {
    static async sendMessage(params: {dtConversationId: ObjectId, dtSenderId: ObjectId, fileUrl: string, fileName: string}) {
        const { dtConversationId, dtSenderId, fileUrl, fileName } = params;

        const fileCreateResult = await FileSvc.create({fileUrl, fileName})

        return DtConversationMessageRepo.create({dtConversationId, dtSenderId, fileId: fileCreateResult.insertedId} as any);
    }

    static async listMessages(params: {dtConversationId: ObjectId, limit: number, requesterId?: ObjectId}) {
        const messages = await DtConversationMessageRepo.listByConversationId(
            params.dtConversationId,
            params.limit
        );
      
        if (!params.requesterId || !messages.length) {
            return messages.map((m: any) => ({
              ...m,
              currentUserReactions: m.currentUserReactions ?? [],
            }));
        }
      
        const messageIds = messages.map((m: any) => m._id);
        const reactions =
            await DtConversationMessageReactionRepo.findByUserIdAndMessageIds(
            params.requesterId,
            messageIds
        );
      
        const byMessageId = new Map<string, string[]>();
        for (const r of reactions as any[]) {
            const id = (r.dtConversationMessageId as ObjectId).toString();
            if (!byMessageId.has(id)) byMessageId.set(id, []);
            byMessageId.get(id)!.push(r.reaction);
        }
      
        return messages.map((m: any) => ({
        ...m,
        currentUserReactions: byMessageId.get(m._id.toString()) ?? [],
        }));
    }

    static async getMessageById(params: {
        dtConversationMessageId: string;
        requesterId?: ObjectId;
    }) {
        const message = await DtConversationMessageRepo.findByIdWithDetails(
            params.dtConversationMessageId
        );
        if (!message) return null;

        if (!params.requesterId) {
            return {
                ...message,
                currentUserReactions: message.currentUserReactions ?? [],
            };
        }

        const reactions =
            await DtConversationMessageReactionRepo.findByUserIdAndMessageIds(
                params.requesterId,
                [message._id]
            );
        const currentUserReactions = (reactions as any[]).map((r: any) => r.reaction);

        return {
            ...message,
            currentUserReactions,
        };
    }
}
