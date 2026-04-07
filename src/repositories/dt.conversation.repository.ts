import { ObjectId } from "mongodb";
import { getDB } from "../utils/mongo";
import { MDtConversation, TDtConversation } from "../models/dt.conversation.model";

export default class DtConversationRepo {
    static collection() {
        return getDB().collection("dtConversation");
    }

    static async findByDmKey(dmKey: string) {
        return this.collection().findOne({ dmKey });
    }
    
    static async listByUserId(dtUserId: ObjectId) {
        return this.collection()
        .find({ participants: dtUserId})
        .sort({ updatedAt: -1, createdAt: -1})
        .toArray();
    }

    static async create(convo: TDtConversation) {
        return this.collection().insertOne(new MDtConversation(convo));
    }

    static parseObjectId(id: string, message: string) {
        try {
            return new ObjectId(id);
        } catch {
            throw new Error(message);
        }
    }
}