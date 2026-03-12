import { ObjectId } from "mongodb";

export type TPsConversation = {
  _id?: ObjectId;
  participants: ObjectId[];
  dmKey: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TPsConversationUpdateOptions = {
  _id?: ObjectId | string;
  participants?: ObjectId[];
  dmKey?: string;
};

export class MPsConversation implements Partial<TPsConversation> {
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
  } = {} as TPsConversation) {
    this._id = _id;
    this.participants = participants;
    this.dmKey = dmKey;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}