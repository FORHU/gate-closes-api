import { ObjectId } from "mongodb";
import BtConversationMessageRepo from "../repositories/bt.conversation.message.repository";
import BtConversationMessageReactionRepo from "../repositories/bt.conversation.message.reaction.repository";
import FileSvc from "./file.service";
import { ObjectId as MongoObjectId } from "mongodb";

export default class BtConversationMessageSvc {

    // Create an audio message in baton touch conversation
    static async sendMessage(params: {btConversationId: ObjectId, btSenderId: ObjectId, fileUrl: string, fileName: string}) {
        const { btConversationId, btSenderId, fileUrl, fileName } = params;

        const fileCreateResult = await FileSvc.create({fileUrl, fileName})

        return BtConversationMessageRepo.create({btConversationId, btSenderId, fileId: fileCreateResult.insertedId} as any);
    }

    // Get all messages in one conversation
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
            const id = (r.btConversationMessageId as MongoObjectId).toString();
            if (!byMessageId.has(id)) byMessageId.set(id, []);
            byMessageId.get(id)!.push(r.reaction);
        }
      
        return messages.map((m: any) => ({
        ...m,
        currentUserReactions: byMessageId.get(m._id.toString()) ?? [],
        }));
    }
}
