import {ObjectId} from "mongodb";
import { getDB } from "../utils/mongo";
import { MDtConversationMessageReaction, TDtConversationMessageReaction, TDtConversationMessageReactionQuery } from "../models/dt.conversation.message.reaction.model";

export default class DtConversationMessageReactionRepo {
    static collection() {
        return getDB().collection("dtConversationMessage.reaction");
    }

    static async create(reaction: TDtConversationMessageReaction) {
        return this.collection().insertOne(new MDtConversationMessageReaction(reaction));
    }

    static async findOne(query: TDtConversationMessageReactionQuery) {
        const filter: any = {};
        if (query._id) filter._id = new ObjectId(query._id as string);
        if (query.dtConversationMessageId) filter.dtConversationMessageId = new ObjectId(query.dtConversationMessageId as string);
        if (query.userId) filter.userId = new ObjectId(query.userId as string);
        if (query.reaction) filter.reaction = query.reaction;

        return this.collection().findOne(filter);
    }

    static async deleteOne(query: TDtConversationMessageReactionQuery) {
        const filter: any = {};
        if (query._id) filter._id = new ObjectId(query._id as string);
        if (query.dtConversationMessageId) filter.dtConversationMessageId = new ObjectId(query.dtConversationMessageId as string);
        if (query.userId) filter.userId = new ObjectId(query.userId as string);
        if (query.reaction) filter.reaction = query.reaction;

        return this.collection().deleteOne(filter);
    }

    static async findByUserIdAndMessageIds(userId: ObjectId, messageIds: ObjectId[]) {
        const ids = messageIds.map((id) => new ObjectId(id));
        return this.collection().find({ userId, dtConversationMessageId: { $in: ids } }).toArray();
    }
}