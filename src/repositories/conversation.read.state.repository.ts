import { ObjectId } from "mongodb";
import { getDB } from "../utils/mongo";

export default class ConversationReadStateRepo {
  static collection() {
    return getDB().collection("conversationReadStates");
  }

  static async upsertLastReadAt(params: {
    conversationId: ObjectId;
    userId: ObjectId;
    lastReadAt: Date;
  }) {
    const now = new Date();
    return this.collection().updateOne(
      {
        conversationId: params.conversationId,
        userId: params.userId,
      },
      {
        $set: {
          lastReadAt: params.lastReadAt,
          updatedAt: now,
        },
        $setOnInsert: {
          _id: new ObjectId(),
          conversationId: params.conversationId,
          userId: params.userId,
          createdAt: now,
        },
      },
      { upsert: true }
    );
  }

  static async findOneByConversationAndUser(
    conversationId: ObjectId,
    userId: ObjectId
  ) {
    return this.collection().findOne({
      conversationId,
      userId,
    });
  }
}
