import { ObjectId } from "mongodb";

export type TTerminalEchoReplyReactionType =
  | "like"
  | "love"
  | "haha"
  | "wow"
  | "sad"
  | "angry";

export type TTerminalEchoReplyReaction = {
  _id?: ObjectId;
  terminalEchoReplyId: ObjectId;
  userId: ObjectId;
  reaction: TTerminalEchoReplyReactionType;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TTerminalEchoReplyReactionQuery = {
  _id?: ObjectId | string;
  terminalEchoReplyId?: ObjectId | string;
  userId?: ObjectId | string;
  reaction?: TTerminalEchoReplyReactionType;
};

export class MTerminalEchoReplyReaction
  implements Partial<TTerminalEchoReplyReaction>
{
  _id?: ObjectId;
  terminalEchoReplyId: ObjectId;
  userId: ObjectId;
  reaction: TTerminalEchoReplyReactionType;
  createdAt?: Date;
  updatedAt?: Date;

  constructor({
    _id = new ObjectId(),
    terminalEchoReplyId,
    userId,
    reaction,
    createdAt = new Date(),
    updatedAt,
  } = {} as TTerminalEchoReplyReaction) {
    this._id = _id;
    this.terminalEchoReplyId = terminalEchoReplyId;
    this.userId = userId;
    this.reaction = reaction;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

