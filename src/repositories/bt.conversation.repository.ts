import { ObjectId } from "mongodb";
import { getDB } from "../utils/mongo";
import { MBtConversation, TBtConversation } from "../models/bt.conversation.model";

export default class BtConversationRepo {
    static collection() {
        return getDB().collection("btConversation");
    }

    static async findByDmKey(dmKey: string) {
        return this.collection().findOne({ dmKey });
    }
    
    static async listByUserId(btUserId: ObjectId) {
        return this.collection()
        .find({ participants: btUserId})
        .sort({ updatedAt: -1, createdAt: -1})
        .toArray();
    }

    static async create(convo: TBtConversation) {
        return this.collection().insertOne(new MBtConversation(convo));
    }

    static parseObjectId(id: string, message: string) {
        try {
            return new ObjectId(id);
        } catch {
            throw new Error(message);
        }
    }
}