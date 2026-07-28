import { ObjectId } from "mongodb";
import DtConversationMessageRepo from "../repositories/dt.conversation.message.repository";
import DtConversationMessageReactionRepo from "../repositories/dt.conversation.message.reaction.repository";

export default class DtConversationMessageReactionSvc {
    static async updateMessageReaction(params: {
        dtConversationMessageId: string;
        reaction: "like" | "love" | "haha" | "wow" | "sad" | "angry";
        userId: ObjectId;
    }) {
        const { dtConversationMessageId, reaction, userId } = params;

        const existing = await DtConversationMessageReactionRepo.findOne({
            dtConversationMessageId,
            userId,
            reaction,
        });

        if (existing) {
            await DtConversationMessageReactionRepo.deleteOne({
                dtConversationMessageId,
                userId,
                reaction,
            });
            const messageUpdate = await DtConversationMessageRepo.updateReaction(
                dtConversationMessageId,
                reaction,
                "decrement"
            );
            return { messageUpdate, eventType: "message_reaction_removed" as const };
        }

        await DtConversationMessageReactionRepo.create({
            dtConversationMessageId: new ObjectId(dtConversationMessageId),
            userId,
            reaction,
        });

        const messageUpdate = await DtConversationMessageRepo.updateReaction(
            dtConversationMessageId,
            reaction,
            "increment"
        );
        return { messageUpdate, eventType: "message_reacted" as const };
    }
}
