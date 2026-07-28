import { ObjectId } from "mongodb";
import BtConversationMessageRepo from "../repositories/bt.conversation.message.repository";
import BtConversationMessageReactionRepo from "../repositories/bt.conversation.message.reaction.repository";
import FileSvc from "./file.service";

export default class BtConversationMessageSvc {
    static async sendMessage(params: {btConversationId: ObjectId, btSenderId: ObjectId, fileUrl: string, fileName: string, audioDuration?: number, waveformData?: number[]}) {
        const { btConversationId, btSenderId, fileUrl, fileName, audioDuration, waveformData } = params;

        const fileCreateResult = await FileSvc.create({
            fileUrl,
            fileName,
            metaData: {
                audioDuration: audioDuration ?? 0,
                waveformData: waveformData ?? [],
            },
        });

        return BtConversationMessageRepo.create({btConversationId, btSenderId, fileId: fileCreateResult.insertedId} as any);
    }

    static async listMessages(params: {btConversationId: ObjectId, limit: number, requesterId?: ObjectId}) {
        const messages = await BtConversationMessageRepo.listByConversationId(
            params.btConversationId,
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
            await BtConversationMessageReactionRepo.findByUserIdAndMessageIds(
            params.requesterId,
            messageIds
        );
      
        const byMessageId = new Map<string, string[]>();
        for (const r of reactions as any[]) {
            const id = (r.btConversationMessageId as ObjectId).toString();
            if (!byMessageId.has(id)) byMessageId.set(id, []);
            byMessageId.get(id)!.push(r.reaction);
        }
      
        return messages.map((m: any) => ({
        ...m,
        currentUserReactions: byMessageId.get(m._id.toString()) ?? [],
        }));
    }

    static async getMessageById(params: {
        btConversationMessageId: string;
        requesterId?: ObjectId;
    }) {
        const message = await BtConversationMessageRepo.findByIdWithDetails(
            params.btConversationMessageId
        );
        if (!message) return null;

        if (!params.requesterId) {
            return {
                ...message,
                currentUserReactions: message.currentUserReactions ?? [],
            };
        }

        const reactions =
            await BtConversationMessageReactionRepo.findByUserIdAndMessageIds(
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
