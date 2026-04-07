import { ObjectId } from "mongodb";

export type TDtConversationMessageReactionType =
  | "like"
  | "love"
  | "haha"
  | "wow"
  | "sad"
  | "angry";

export type TDtConversationMessageReaction = {
  _id?: ObjectId;
  dtConversationMessageId: ObjectId;
  userId: ObjectId;
  reaction: TDtConversationMessageReactionType;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TDtConversationMessageReactionQuery = {
  _id?: ObjectId | string;
  dtConversationMessageId?: ObjectId | string;
  userId?: ObjectId | string;
  reaction?: TDtConversationMessageReactionType;
};

export class MDtConversationMessageReaction implements Partial<TDtConversationMessageReaction>{
  _id?: ObjectId;
  dtConversationMessageId: ObjectId;
  userId: ObjectId;
  reaction: TDtConversationMessageReactionType;
  createdAt?: Date;
  updatedAt?: Date;

  constructor({
    _id = new ObjectId(),
    dtConversationMessageId,
    userId,
    reaction,
    createdAt = new Date(),
    updatedAt,
  } = {} as TDtConversationMessageReaction) {
    this._id = _id;
    this.dtConversationMessageId = dtConversationMessageId;
    this.userId = userId;
    this.reaction = reaction;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

