import { ObjectId } from "mongodb";

export type TTerminalEchoReply = {
  _id?: ObjectId;
  terminalEchoId: ObjectId;
  senderId: ObjectId;
  fileId?: ObjectId;
  textMessage?: string;
  countListens?: number;
  countReactLike?: number;
  countReactLove?: number;
  countReactHaha?: number;
  countReactWow?: number;
  countReactSad?: number;
  countReactAngry?: number;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TTerminalEchoReplyUpdateOptions = {
  _id?: ObjectId | string;
  terminalEchoId: ObjectId | string;
  senderId: ObjectId | string;
  fileId?: ObjectId | string;
  textMessage?: string;
  countListens?: number;
  countReactLike?: number;
  countReactLove?: number;
  countReactHaha?: number;
  countReactWow?: number;
  countReactSad?: number;
  countReactAngry?: number;
};

export class MTerminalEchoReply implements Partial<TTerminalEchoReply> {
  _id?: ObjectId;
  terminalEchoId: ObjectId;
  senderId: ObjectId;
  fileId?: ObjectId;
  textMessage?: string;
  countListens?: number;
  countReactLike?: number;
  countReactLove?: number;
  countReactHaha?: number;
  countReactWow?: number;
  countReactSad?: number;
  countReactAngry?: number;
  createdAt?: Date;
  updatedAt?: Date;

  constructor({ _id = new ObjectId(), terminalEchoId, senderId, fileId, textMessage = "", countListens = 0, countReactLike = 0, countReactLove = 0, countReactHaha = 0, countReactWow = 0, countReactSad = 0, countReactAngry = 0, createdAt = new Date(), updatedAt } = {} as TTerminalEchoReply) {
    this._id = _id;
    this.terminalEchoId = terminalEchoId;
    this.senderId = senderId;
    this.fileId = fileId;
    this.textMessage = textMessage;
    this.countListens = countListens;
    this.countReactLike = countReactLike;
    this.countReactLove = countReactLove;
    this.countReactHaha = countReactHaha;
    this.countReactWow = countReactWow;
    this.countReactSad = countReactSad;
    this.countReactAngry = countReactAngry;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}