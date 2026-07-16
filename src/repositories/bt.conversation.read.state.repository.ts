import { ObjectId } from "mongodb";
import { getDB } from "../utils/mongo";

export default class BtConversationReadStateRepo {
  static collection() {
    return getDB().collection("btConversationReadState");
  }

  static async upsertLastReadAt(params: {
    btConversationId: ObjectId;
    userId: ObjectId;
    lastReadAt: Date;
  }) {
    const now = new Date();
    return this.collection().updateOne(
      {
        btConversationId: params.btConversationId,
        userId: params.userId,
      },
      {
        $set: {
          lastReadAt: params.lastReadAt,
          updatedAt: now,
        },
        $setOnInsert: {
          _id: new ObjectId(),
          btConversationId: params.btConversationId,
          userId: params.userId,
          createdAt: now,
        },
      },
      { upsert: true }
    );
  }

  static async findOneByConversationAndUser(
    btConversationId: ObjectId,
    userId: ObjectId
  ) {
    return this.collection().findOne({
      btConversationId,
      userId,
    });
  }

  static async createIndexes() {
    await this.collection().createIndex(
      { btConversationId: 1, userId: 1 },
      { unique: true }
    );
    await this.collection().createIndex({ userId: 1, updatedAt: -1 });
  }
}
