import { ObjectId } from "mongodb";

export type TFsConversationMessage = {
  _id?: ObjectId;
  fsSenderId: ObjectId;
  fsConversationId: ObjectId;
  audioUrl: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TFsConversationMessageUpdateOptions = {
  _id?: ObjectId | string;
  fsSenderId: ObjectId | string;
  fsConversationId: ObjectId | string;
  audioUrl: string;
};

export class MFsConversationMessage implements Partial<TFsConversationMessage> {
  _id?: ObjectId;
  fsSenderId: ObjectId;
  fsConversationId: ObjectId;
  audioUrl: string;
  createdAt?: Date;
  updatedAt?: Date;

  constructor({ _id = new ObjectId(), fsSenderId, fsConversationId, audioUrl = "", createdAt = new Date(), updatedAt } = {} as TFsConversationMessage) {
    this._id = _id;
    this.fsSenderId = fsSenderId;
    this.fsConversationId = fsConversationId;
    this.audioUrl = audioUrl;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}