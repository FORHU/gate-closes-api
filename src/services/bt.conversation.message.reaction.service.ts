import { ObjectId } from "mongodb";
import BtConversationMessageRepo from "../repositories/bt.conversation.message.repository";
import BtConversationMessageReactionRepo from "../repositories/bt.conversation.message.reaction.repository";

export default class btConversationMessageRecationSvc {

    // Update reaction data when user react in one of the messages
    static async updateMessageReaction(params: {btConversationMessageId: ObjectId, reaction: "like" | "love" | "haha" | "wow" | "sad" | "angry", userId: ObjectId}){
        const { btConversationMessageId, reaction, userId} = params;

        const existing = await BtConversationMessageReactionRepo.findOne({ btConversationMessageId, userId, reaction})

        if (existing) {
            await BtConversationMessageReactionRepo.deleteOne({
                btConversationMessageId,
                userId,
                reaction,
            });
            return BtConversationMessageRepo.updateReaction(
                btConversationMessageId,
                reaction,
                "decrement"
            );
        }
        await BtConversationMessageReactionRepo.create({
            btConversationMessageId: new ObjectId(btConversationMessageId),
            userId,
            reaction,
        } as any);

        return BtConversationMessageRepo.updateReaction(
            btConversationMessageId,
            reaction,
            "increment"
        );
    }
}