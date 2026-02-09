import { ObjectId } from "mongodb";

export type TDtConversation = {
  _id?: ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TDtConversationUpdateOptions = {
  _id?: ObjectId | string;
};

export class MDtConversation implements Partial<TDtConversation> {
  _id?: ObjectId;
  createdAt?: Date;
  updatedAt?: Date;

  constructor({ _id = new ObjectId(), createdAt = new Date(), updatedAt } = {} as TDtConversation) {
    this._id = _id;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}