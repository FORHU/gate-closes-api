import { ObjectId } from "mongodb";

export type TPsConversationMessage = {
  _id?: ObjectId;
  psSenderId: ObjectId;
  psConversationId: ObjectId;
  fileId: ObjectId;
  countReactLike?: number;
  countReactLove?: number;
  countReactHaha?: number;
  countReactWow?: number;
  countReactSad?: number;
  countReactAngry?: number;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TPsConversationMessageUpdateOptions = {
  _id?: ObjectId | string;
  psSenderId: ObjectId | string;
  psConversationId: ObjectId | string;
  fileId: ObjectId | string;
  countReactLike?: number;
  countReactLove?: number;
  countReactHaha?: number;
  countReactWow?: number;
  countReactSad?: number;
  countReactAngry?: number;
};

export class MPsConversationMessage implements Partial<TPsConversationMessage> {
  _id?: ObjectId;
  psSenderId: ObjectId;
  psConversationId: ObjectId;
  fileId: ObjectId;
  countReactLike?: number;
  countReactLove?: number;
  countReactHaha?: number;
  countReactWow?: number;
  countReactSad?: number;
  countReactAngry?: number;
  createdAt?: Date;
  updatedAt?: Date;

  constructor({
    _id = new ObjectId(),
    psSenderId,
    psConversationId,
    fileId,
    countReactLike = 0,
    countReactLove = 0,
    countReactHaha = 0,
    countReactWow = 0,
    countReactSad = 0,
    countReactAngry = 0,
    createdAt = new Date(),
    updatedAt,
  } = {} as TPsConversationMessage) {
    this._id = _id;
    this.psSenderId = psSenderId;
    this.psConversationId = psConversationId;
    this.fileId = fileId;
    this.countReactLike = countReactLike;
    this.countReactLove = countReactLove;
    this.countReactHaha = countReactHaha;
    this.countReactWow = countReactWow;
    this.countReactSad = countReactSad;
    this.countReactAngry = countReactAngry;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}