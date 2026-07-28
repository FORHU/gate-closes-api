import { ObjectId } from "mongodb";
import {
  MPsConversationMessageReaction,
  TPsConversationMessageReaction,
  TPsConversationMessageReactionQuery,
} from "../models/ps.conversation.message.reaction.model";
import { getDB } from "../utils/mongo";

export default class PsConversationMessageReactionRepo {
  static collection() {
    return getDB().collection("psConversationMessage.reaction");
  }

  static async create(reaction: TPsConversationMessageReaction) {
    return this.collection().insertOne(
      new MPsConversationMessageReaction(reaction)
    );
  }

  static async findOne(query: TPsConversationMessageReactionQuery) {
    const filter: Record<string, unknown> = {};
    if (query._id) filter._id = new ObjectId(query._id as string);
    if (query.psConversationMessageId)
      filter.psConversationMessageId = new ObjectId(
        query.psConversationMessageId as string
      );
    if (query.userId) filter.userId = new ObjectId(query.userId as string);
    if (query.reaction) filter.reaction = query.reaction;

    return this.collection().findOne(filter);
  }

  static async deleteOne(query: TPsConversationMessageReactionQuery) {
    const filter: Record<string, unknown> = {};
    if (query._id) filter._id = new ObjectId(query._id as string);
    if (query.psConversationMessageId)
      filter.psConversationMessageId = new ObjectId(
        query.psConversationMessageId as string
      );
    if (query.userId) filter.userId = new ObjectId(query.userId as string);
    if (query.reaction) filter.reaction = query.reaction;

    return this.collection().deleteOne(filter);
  }

  /** Batch: all reactions by this user for the given message ids. Used to enrich list results. */
  static async findByUserIdAndMessageIds(
    userId: string | ObjectId,
    messageIds: (string | ObjectId)[]
  ) {
    const ids = messageIds.map((id) => new ObjectId(id));
    return this.collection()
      .find({
        userId: new ObjectId(userId as string),
        psConversationMessageId: { $in: ids },
      })
      .toArray();
  }
}

