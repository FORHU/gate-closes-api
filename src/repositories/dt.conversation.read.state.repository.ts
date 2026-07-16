import { ObjectId } from "mongodb";
import { getDB } from "../utils/mongo";

export default class DtConversationReadStateRepo {
  static collection() {
    return getDB().collection("dtConversationReadState");
  }

  static async upsertLastReadAt(params: {
    dtConversationId: ObjectId;
    userId: ObjectId;
    lastReadAt: Date;
  }) {
    const now = new Date();
    return this.collection().updateOne(
      {
        dtConversationId: params.dtConversationId,
        userId: params.userId,
      },
      {
        $set: {
          lastReadAt: params.lastReadAt,
          updatedAt: now,
        },
        $setOnInsert: {
          _id: new ObjectId(),
          dtConversationId: params.dtConversationId,
          userId: params.userId,
          createdAt: now,
        },
      },
      { upsert: true }
    );
  }

  static async findOneByConversationAndUser(
    dtConversationId: ObjectId,
    userId: ObjectId
  ) {
    return this.collection().findOne({
      dtConversationId,
      userId,
    });
  }

  static async createIndexes() {
    await this.collection().createIndex(
      { dtConversationId: 1, userId: 1 },
      { unique: true }
    );
    await this.collection().createIndex({ userId: 1, updatedAt: -1 });
  }
}
