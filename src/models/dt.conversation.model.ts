import { ObjectId } from "mongodb";

export type TDtConversation = {
  _id?: ObjectId;
  participants: ObjectId[];
  dmKey: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TDtConversationUpdateOptions = {
  _id?: ObjectId | string;
  participants?: ObjectId[];
  dmKey?: string;
};

export class MDtConversation implements Partial<TDtConversation> {
  _id?: ObjectId;
  participants: ObjectId[];
  dmKey: string;
  createdAt?: Date;
  updatedAt?: Date;

  constructor({
    _id = new ObjectId(),
    participants,
    dmKey = "",
    createdAt = new Date(),
    updatedAt,
  } = {} as TDtConversation) {
    this._id = _id;
    this.participants = participants;
    this.dmKey = dmKey;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}