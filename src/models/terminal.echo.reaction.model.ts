import { ObjectId } from "mongodb";

export type TTerminalEchoReactionType =
  | "like"
  | "love"
  | "haha"
  | "wow"
  | "sad"
  | "angry";

export type TTerminalEchoReaction = {
  _id?: ObjectId;
  terminalEchoId: ObjectId;
  userId: ObjectId;
  reaction: TTerminalEchoReactionType;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TTerminalEchoReactionQuery = {
  _id?: ObjectId | string;
  terminalEchoId?: ObjectId | string;
  userId?: ObjectId | string;
  reaction?: TTerminalEchoReactionType;
};

export class MTerminalEchoReaction implements Partial<TTerminalEchoReaction> {
  _id?: ObjectId;
  terminalEchoId: ObjectId;
  userId: ObjectId;
  reaction: TTerminalEchoReactionType;
  createdAt?: Date;
  updatedAt?: Date;

  constructor({
    _id = new ObjectId(),
    terminalEchoId,
    userId,
    reaction,
    createdAt = new Date(),
    updatedAt,
  } = {} as TTerminalEchoReaction) {
    this._id = _id;
    this.terminalEchoId = terminalEchoId;
    this.userId = userId;
    this.reaction = reaction;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

