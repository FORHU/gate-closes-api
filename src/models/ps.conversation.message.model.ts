import { ObjectId } from "mongodb";

export type TPsConversationMessage = {
  _id?: ObjectId;
  psSenderId: ObjectId;
  psConversationId: ObjectId;
  audioUrl: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TPsConversationMessageUpdateOptions = {
  _id?: ObjectId | string;
  psSenderId: ObjectId | string;
  psConversationId: ObjectId | string;
  audioUrl: string;
};

export class MPsConversationMessage implements Partial<TPsConversationMessage> {
  _id?: ObjectId;
  psSenderId: ObjectId;
  psConversationId: ObjectId;
  audioUrl: string;
  createdAt?: Date;
  updatedAt?: Date;

  constructor({ _id = new ObjectId(), psSenderId, psConversationId, audioUrl = "", createdAt = new Date(), updatedAt } = {} as TPsConversationMessage) {
    this._id = _id;
    this.psSenderId = psSenderId;
    this.psConversationId = psConversationId;
    this.audioUrl = audioUrl;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}
