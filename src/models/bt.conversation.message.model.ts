import { ObjectId } from "mongodb";

export type TBtConversationMessage = {
  _id?: ObjectId;
  btSenderId: ObjectId;
  btConversationId: ObjectId;
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

export type TBtConversationMessageUpdateOptions = {
  _id?: ObjectId | string;
  btSenderId: ObjectId | string;
  btConversationId: ObjectId | string;
  fileId: ObjectId | string;
  countReactLike?: number;
  countReactLove?: number;
  countReactHaha?: number;
  countReactWow?: number;
  countReactSad?: number;
  countReactAngry?: number;
};

export class MBtConversationMessage implements Partial<TBtConversationMessage> {
  _id?: ObjectId;
  btSenderId: ObjectId;
  btConversationId: ObjectId;
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
    btSenderId,
    btConversationId,
    fileId,
    countReactLike = 0,
    countReactLove = 0,
    countReactHaha = 0,
    countReactWow = 0,
    countReactSad = 0,
    countReactAngry = 0,
    createdAt = new Date(),
    updatedAt,
  } = {} as TBtConversationMessage) {
    this._id = _id;
    this.btSenderId = btSenderId;
    this.btConversationId = btConversationId;
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