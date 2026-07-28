import {ObjectId} from "mongodb";
import { getDB } from "../utils/mongo";
import { MBtConversationMessageReaction, TBtConversationMessageReaction, TBtConversationMessageReactionQuery } from "../models/bt.conversation.message.reaction.model";

export default class BtConversationMessageReactionRepo {
    static collection() {
        return getDB().collection("btConversationMessage.reaction");
    }

    static async create(reaction: TBtConversationMessageReaction) {
        return this.collection().insertOne(new MBtConversationMessageReaction(reaction));
    }

    static async findOne(query: TBtConversationMessageReactionQuery) {
        const filter: Record<string, unknown> = {};
        if (query._id) filter._id = new ObjectId(query._id as string);
        if (query.btConversationMessageId) filter.btConversationMessageId = new ObjectId(query.btConversationMessageId as string);
        if (query.userId) filter.userId = new ObjectId(query.userId as string);
        if (query.reaction) filter.reaction = query.reaction;

        return this.collection().findOne(filter);
    }

    static async deleteOne(query: TBtConversationMessageReactionQuery) {
        const filter: Record<string, unknown> = {};
        if (query._id) filter._id = new ObjectId(query._id as string);
        if (query.btConversationMessageId) filter.btConversationMessageId = new ObjectId(query.btConversationMessageId as string);
        if (query.userId) filter.userId = new ObjectId(query.userId as string);
        if (query.reaction) filter.reaction = query.reaction;

        return this.collection().deleteOne(filter);
    }

    static async findByUserIdAndMessageIds(userId: ObjectId, messageIds: ObjectId[]) {
        const ids = messageIds.map((id) => new ObjectId(id));
        return this.collection().find({ userId, btConversationMessageId: { $in: ids } }).toArray();
    }
}