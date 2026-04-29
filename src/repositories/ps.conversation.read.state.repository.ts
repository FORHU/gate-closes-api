import { ObjectId } from "mongodb";
import {
  MPsConversationReadState,
  TPsConversationReadState,
} from "../models/ps.conversation.read.state.model";
import { getDB } from "../utils/mongo";

export default class PsConversationReadStateRepo {
  static collection() {
    return getDB().collection("psConversationReadState");
  }

  static async upsertLastReadAt(params: {
    psConversationId: ObjectId;
    userId: ObjectId;
    lastReadAt: Date;
  }) {
    const now = new Date();
    return this.collection().updateOne(
      {
        psConversationId: params.psConversationId,
        userId: params.userId,
      },
      {
        $set: {
          lastReadAt: params.lastReadAt,
          updatedAt: now,
        },
        $setOnInsert: {
          ...new MPsConversationReadState({
            psConversationId: params.psConversationId,
            userId: params.userId,
            lastReadAt: params.lastReadAt,
            createdAt: now,
            updatedAt: now,
          } as TPsConversationReadState),
        },
      },
      { upsert: true }
    );
  }

  static async findOneByConversationAndUser(
    psConversationId: ObjectId,
    userId: ObjectId
  ) {
    return this.collection().findOne({
      psConversationId,
      userId,
    });
  }

  static async createIndexes() {
    await this.collection().createIndex(
      { psConversationId: 1, userId: 1 },
      { unique: true }
    );
    await this.collection().createIndex({ userId: 1, updatedAt: -1 });
  }
}
