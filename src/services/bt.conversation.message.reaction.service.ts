import { ObjectId } from "mongodb";
import BtConversationMessageRepo from "../repositories/bt.conversation.message.repository";
import BtConversationMessageReactionRepo from "../repositories/bt.conversation.message.reaction.repository";

export default class BtConversationMessageReactionSvc {
    static async updateMessageReaction(params: {
        btConversationMessageId: string;
        reaction: "like" | "love" | "haha" | "wow" | "sad" | "angry";
        userId: ObjectId;
    }) {
        const { btConversationMessageId, reaction, userId } = params;

        const existing = await BtConversationMessageReactionRepo.findOne({
            btConversationMessageId,
            userId,
            reaction,
        });

        if (existing) {
            await BtConversationMessageReactionRepo.deleteOne({
                btConversationMessageId,
                userId,
                reaction,
            });
            const messageUpdate = await BtConversationMessageRepo.updateReaction(
                btConversationMessageId,
                reaction,
                "decrement"
            );
            return { messageUpdate, eventType: "message_reaction_removed" as const };
        }

        await BtConversationMessageReactionRepo.create({
            btConversationMessageId: new ObjectId(btConversationMessageId),
            userId,
            reaction,
        } as any);

        const messageUpdate = await BtConversationMessageRepo.updateReaction(
            btConversationMessageId,
            reaction,
            "increment"
        );
        return { messageUpdate, eventType: "message_reacted" as const };
    }
}
