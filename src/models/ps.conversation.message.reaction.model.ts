import { ObjectId } from "mongodb";

export type TPsConversationMessageReactionType =
  | "like"
  | "love"
  | "haha"
  | "wow"
  | "sad"
  | "angry";

export type TPsConversationMessageReaction = {
  _id?: ObjectId;
  psConversationMessageId: ObjectId;
  userId: ObjectId;
  reaction: TPsConversationMessageReactionType;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TPsConversationMessageReactionQuery = {
  _id?: ObjectId | string;
  psConversationMessageId?: ObjectId | string;
  userId?: ObjectId | string;
  reaction?: TPsConversationMessageReactionType;
};

export class MPsConversationMessageReaction implements Partial<TPsConversationMessageReaction>{
  _id?: ObjectId;
  psConversationMessageId: ObjectId;
  userId: ObjectId;
  reaction: TPsConversationMessageReactionType;
  createdAt?: Date;
  updatedAt?: Date;

  constructor({
    _id = new ObjectId(),
    psConversationMessageId,
    userId,
    reaction,
    createdAt = new Date(),
    updatedAt,
  } = {} as TPsConversationMessageReaction) {
    this._id = _id;
    this.psConversationMessageId = psConversationMessageId;
    this.userId = userId;
    this.reaction = reaction;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

