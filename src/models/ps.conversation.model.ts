import { ObjectId } from "mongodb";

export type TPsConversation = {
  _id?: ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TPsConversationUpdateOptions = {
  _id?: ObjectId | string;
};

export class MPsConversation implements Partial<TPsConversation> {
  _id?: ObjectId;
  createdAt?: Date;
  updatedAt?: Date;

  constructor({ _id = new ObjectId(), createdAt = new Date(), updatedAt } = {} as TPsConversation) {
    this._id = _id;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}
