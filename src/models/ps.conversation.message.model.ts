import { ObjectId } from "mongodb";

export type TPsConversationMessage = {
  _id?: ObjectId;
  psSenderId: ObjectId;
  psConversationId: ObjectId;
  fileId: ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TPsConversationMessageUpdateOptions = {
  _id?: ObjectId | string;
  psSenderId: ObjectId | string;
  psConversationId: ObjectId | string;
  fileId: ObjectId | string;
};

export class MPsConversationMessage implements Partial<TPsConversationMessage> {
  _id?: ObjectId;
  psSenderId: ObjectId;
  psConversationId: ObjectId;
  fileId: ObjectId;
  createdAt?: Date;
  updatedAt?: Date;

  constructor({
    _id = new ObjectId(),
    psSenderId,
    psConversationId,
    fileId,
    createdAt = new Date(),
    updatedAt,
  } = {} as TPsConversationMessage) {
    this._id = _id;
    this.psSenderId = psSenderId;
    this.psConversationId = psConversationId;
    this.fileId = fileId;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}