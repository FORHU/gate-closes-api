import { ObjectId } from "mongodb";

export type TTerminalEchoReply = {
  _id?: ObjectId;
  terminalEchoId: ObjectId;
  audioUrl: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TTerminalEchoReplyUpdateOptions = {
  _id?: ObjectId | string;
  terminalEchoId: ObjectId | string;
  audioUrl: string;
};

export class MTerminalEchoReply implements Partial<TTerminalEchoReply> {
  _id?: ObjectId;
  terminalEchoId: ObjectId;
  audioUrl: string;
  createdAt?: Date;
  updatedAt?: Date;

  constructor({ _id = new ObjectId(), terminalEchoId, audioUrl = "", createdAt = new Date(), updatedAt } = {} as TTerminalEchoReply) {
    this._id = _id;
    this.terminalEchoId = terminalEchoId;
    this.audioUrl = audioUrl;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}