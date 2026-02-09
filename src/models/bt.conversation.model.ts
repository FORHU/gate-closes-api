import { ObjectId } from "mongodb";

export type TBtConversation = {
  _id?: ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TBtConversationUpdateOptions = {
  _id?: ObjectId | string;
};

export class MBtConversation implements Partial<TBtConversation> {
  _id?: ObjectId;
  createdAt?: Date;
  updatedAt?: Date;

  constructor({ _id = new ObjectId(), createdAt = new Date(), updatedAt } = {} as TBtConversation) {
    this._id = _id;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}