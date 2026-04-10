import { ObjectId } from "mongodb";
import PsConversationMessageRepo from "../repositories/ps.conversation.message.repository";
import PsConversationMessageReactionRepo from "../repositories/ps.conversation.message.reaction.repository";

export default class PsConversationMessageReactionSvc {

  // Update reaction data when user react in one of the messages
  static async updateMessageReaction(params: {
    psConversationMessageId: string;
    reaction: "like" | "love" | "haha" | "wow" | "sad" | "angry";
    userId: ObjectId;
  }) {
    const { psConversationMessageId, reaction, userId } = params;

    const existing = await PsConversationMessageReactionRepo.findOne({
      psConversationMessageId,
      userId,
      reaction,
    });

    if (existing) {
      await PsConversationMessageReactionRepo.deleteOne({
        psConversationMessageId,
        userId,
        reaction,
      });
      return PsConversationMessageRepo.updateReaction(
        psConversationMessageId,
        reaction,
        "decrement"
      );
    }

    await PsConversationMessageReactionRepo.create({
      psConversationMessageId: new ObjectId(psConversationMessageId),
      userId,
      reaction,
    } as any);

    return PsConversationMessageRepo.updateReaction(
      psConversationMessageId,
      reaction,
      "increment"
    );
  }
}
