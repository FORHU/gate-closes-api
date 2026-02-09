import { ObjectId } from "mongodb";

export type TDtConversationMessage = {
  _id?: ObjectId;
  dtSenderId: ObjectId;
  dtConversationId: ObjectId;
  audioUrl: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TDtConversationMessageUpdateOptions = {
  _id?: ObjectId | string;
  dtSenderId: ObjectId | string;
  dtConversationId: ObjectId | string;
  audioUrl: string;
};

export class MDtConversationMessage implements Partial<TDtConversationMessage> {
  _id?: ObjectId;
  dtSenderId: ObjectId;
  dtConversationId: ObjectId;
  audioUrl: string;
  createdAt?: Date;
  updatedAt?: Date;

  constructor({ _id = new ObjectId(), dtSenderId, dtConversationId, audioUrl = "", createdAt = new Date(), updatedAt } = {} as TDtConversationMessage) {
    this._id = _id;
    this.dtSenderId = dtSenderId;
    this.dtConversationId = dtConversationId;
    this.audioUrl = audioUrl;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}