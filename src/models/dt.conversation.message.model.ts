import { ObjectId } from "mongodb";

export type TDtConversationMessage = {
  _id?: ObjectId;
  dtSenderId: ObjectId;
  dtConversationId: ObjectId;
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

export type TDtConversationMessageUpdateOptions = {
  _id?: ObjectId | string;
  dtSenderId: ObjectId | string;
  dtConversationId: ObjectId | string;
  fileId: ObjectId | string;
  countReactLike?: number;
  countReactLove?: number;
  countReactHaha?: number;
  countReactWow?: number;
  countReactSad?: number;
  countReactAngry?: number;
};

export class MDtConversationMessage implements Partial<TDtConversationMessage> {
  _id?: ObjectId;
  dtSenderId: ObjectId;
  dtConversationId: ObjectId;
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
    dtSenderId,
    dtConversationId,
    fileId,
    countReactLike = 0,
    countReactLove = 0,
    countReactHaha = 0,
    countReactWow = 0,
    countReactSad = 0,
    countReactAngry = 0,
    createdAt = new Date(),
    updatedAt,
  } = {} as TDtConversationMessage) {
    this._id = _id;
    this.dtSenderId = dtSenderId;
    this.dtConversationId = dtConversationId;
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