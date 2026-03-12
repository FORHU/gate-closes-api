import { ObjectId } from "mongodb";
import { getDB } from "../utils/mongo";
import { MPsConversation, TPsConversation } from "../models/ps.conversation.model";

export default class PsConversationRepo {
  static collection() {
    return getDB().collection("psConversation");
  }

  static async findByDmKey(dmKey: string) {
    return this.collection().findOne({ dmKey });
  }

  static async listByUserId(psUserId: ObjectId) {
    return this.collection()
      .find({ participants: psUserId })
      .sort({ updatedAt: -1, createdAt: -1 })
      .toArray();
  }

  static async create(convo: TPsConversation) {
    return this.collection().insertOne(new MPsConversation(convo));
  }

  static parseObjectId(id: string, message: string) {
    try {
      return new ObjectId(id);
    } catch {
      throw new Error(message);
    }
  }
}

