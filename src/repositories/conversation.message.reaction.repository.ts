import { ObjectId } from "mongodb";
import { getDB } from "../utils/mongo";

export type TConversationMessageReaction = {
  _id?: ObjectId;
  messageId: ObjectId;
  userId: ObjectId;
  reaction: string;
  createdAt?: Date;
};

export default class ConversationMessageReactionRepo {
  static collection() {
    return getDB().collection("conversation.messages.reaction");
  }

  static async toggleReaction(params: {
    messageId: ObjectId;
    userId: ObjectId;
    reaction: string;
  }): Promise<"increment" | "decrement"> {
    const { messageId, userId, reaction } = params;
    const existing = await this.collection().findOne({
      messageId,
      userId,
      reaction,
    });

    if (existing) {
      await this.collection().deleteOne({ _id: existing._id });
      return "decrement";
    }

    await this.collection().insertOne({
      messageId,
      userId,
      reaction,
      createdAt: new Date(),
    });
    return "increment";
  }

  static async findByUserIdAndMessageIds(
    userId: string | ObjectId,
    messageIds: (string | ObjectId)[]
  ) {
    const ids = messageIds.map((id) => new ObjectId(id));
    return this.collection()
      .find({
        userId: new ObjectId(userId as string),
        messageId: { $in: ids },
      })
      .toArray();
  }
}
