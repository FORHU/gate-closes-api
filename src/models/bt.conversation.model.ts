import { ObjectId } from "mongodb";

export type TBtConversation = {
  _id?: ObjectId;
  participants: ObjectId[];
  dmKey: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TBtConversationUpdateOptions = {
  _id?: ObjectId | string;
  participants: ObjectId[];
  dmKey: string;
};

export class MBtConversation implements Partial<TBtConversation> {
  _id?: ObjectId;
  participants: ObjectId[];
  dmKey: string;
  createdAt?: Date;
  updatedAt?: Date;

  constructor({ _id = new ObjectId(), participants, dmKey = "", createdAt = new Date(), updatedAt } = {} as TBtConversation) {
    this._id = _id;
    this.participants = participants;
    this.dmKey = dmKey;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}