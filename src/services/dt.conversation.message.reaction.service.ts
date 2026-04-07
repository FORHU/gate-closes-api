import { ObjectId } from "mongodb";
import DtConversationMessageRepo from "../repositories/dt.conversation.message.repository";
import DtConversationMessageReactionRepo from "../repositories/dt.conversation.message.reaction.repository";

export default class DtConversationMessageRecationSvc {
    static async updateMessageReaction(params: {dtConversationMessageId: ObjectId, reaction: "like" | "love" | "haha" | "wow" | "sad" | "angry", userId: ObjectId}){
        const { dtConversationMessageId, reaction, userId} = params;

        const existing = await DtConversationMessageReactionRepo.findOne({ dtConversationMessageId, userId, reaction})

        if (existing) {
            await DtConversationMessageReactionRepo.deleteOne({
                dtConversationMessageId,
                userId,
                reaction,
            });
            return DtConversationMessageRepo.updateReaction(
                dtConversationMessageId,
                reaction,
                "decrement"
            );
        }
        await DtConversationMessageReactionRepo.create({
            dtConversationMessageId: new ObjectId(dtConversationMessageId),
            userId,
            reaction,
        } as any);

        return DtConversationMessageRepo.updateReaction(
            dtConversationMessageId,
            reaction,
            "increment"
        );
    }
}