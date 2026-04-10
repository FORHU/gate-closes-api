import { ObjectId } from "mongodb";

export type TBtConversationMessageReactionType =
  | "like"
  | "love"
  | "haha"
  | "wow"
  | "sad"
  | "angry";

export type TBtConversationMessageReaction = {
  _id?: ObjectId;
  btConversationMessageId: ObjectId;
  userId: ObjectId;
  reaction: TBtConversationMessageReactionType;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TBtConversationMessageReactionQuery = {
  _id?: ObjectId | string;
  btConversationMessageId?: ObjectId | string;
  userId?: ObjectId | string;
  reaction?: TBtConversationMessageReactionType;
};

export class MBtConversationMessageReaction implements Partial<TBtConversationMessageReaction>{
  _id?: ObjectId;
  btConversationMessageId: ObjectId;
  userId: ObjectId;
  reaction: TBtConversationMessageReactionType;
  createdAt?: Date;
  updatedAt?: Date;

  constructor({
    _id = new ObjectId(),
    btConversationMessageId,
    userId,
    reaction,
    createdAt = new Date(),
    updatedAt,
  } = {} as TBtConversationMessageReaction) {
    this._id = _id;
    this.btConversationMessageId = btConversationMessageId;
    this.userId = userId;
    this.reaction = reaction;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

