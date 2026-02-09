import { ObjectId } from "mongodb";

export type TBtConversationMessage = {
  _id?: ObjectId;
  btSenderId: ObjectId;
  btConversationId: ObjectId;
  audioUrl: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TBtConversationMessageUpdateOptions = {
  _id?: ObjectId | string;
  btSenderId: ObjectId | string;
  btConversationId: ObjectId | string;
  audioUrl: string;
};

export class MBtConversationMessage implements Partial<TBtConversationMessage> {
  _id?: ObjectId;
  btSenderId: ObjectId;
  btConversationId: ObjectId;
  audioUrl: string;
  createdAt?: Date;
  updatedAt?: Date;

  constructor({ _id = new ObjectId(), btSenderId, btConversationId, audioUrl = "", createdAt = new Date(), updatedAt } = {} as TBtConversationMessage) {
    this._id = _id;
    this.btSenderId = btSenderId;
    this.btConversationId = btConversationId;
    this.audioUrl = audioUrl;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}