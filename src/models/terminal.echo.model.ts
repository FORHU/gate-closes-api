import { ObjectId } from "mongodb";

export type TTerminalEcho = {
  _id?: ObjectId;
  senderId: ObjectId;
  fileId?: ObjectId;
  textMessage?: string;
  location?: { type: "Point", coordinates: [number, number]};
  airportName?: string;
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

export type TTerminalEchoUpdateOptions = {
  _id?: ObjectId | string;
  senderId: ObjectId | string;
  fileId?: ObjectId | string;
  textMessage?: string;
  location?: { type: "Point", coordinates: [number, number]};
  airportName?: string;
  countListens?: number;
  countReactLike?: number;
  countReactLove?: number;
  countReactHaha?: number;
  countReactWow?: number;
  countReactSad?: number;
  countReactAngry?: number;
};

export class MTerminalEcho implements Partial<TTerminalEcho> {
  _id?: ObjectId;
  senderId: ObjectId;
  fileId?: ObjectId;
  textMessage?: string;
  location?: { type: "Point", coordinates: [number, number] };
  airportName?: string;
  countListens?: number;
  countReactLike?: number;
  countReactLove?: number;
  countReactHaha?: number;
  countReactWow?: number;
  countReactSad?: number;
  countReactAngry?: number;
  createdAt?: Date;
  updatedAt?: Date;

  constructor({_id = new ObjectId(), senderId, fileId, textMessage = "", location = { type: "Point", coordinates: [0, 0] }, airportName = "", countListens = 0, countReactLike = 0, countReactLove = 0, countReactHaha = 0, countReactWow = 0, countReactSad = 0, countReactAngry = 0, createdAt = new Date(), updatedAt} = {} as TTerminalEcho) {
    this._id = _id;
    this.senderId = senderId;
    this.fileId = fileId;
    this.textMessage = textMessage;
    this.location = location;
    this.airportName = airportName;
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