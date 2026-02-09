import { ObjectId } from "mongodb";

export type TTerminalEcho = {
  _id?: ObjectId;
  senderId: ObjectId;
  audioUrl?: string;
  location?: { type: "Point", coordinates: [number, number]};
  createdAt?: Date;
  updatedAt?: Date;
};

export type TTerminalEchoUpdateOptions = {
  _id?: ObjectId | string;
  senderId: ObjectId | string;
  audioUrl: string;
  location?: { type: "Point", coordinates: [number, number]};
};

export class MTerminalEcho implements Partial<TTerminalEcho> {
  _id?: ObjectId;
  senderId: ObjectId;
  audioUrl?: string;
  location?: { type: "Point", coordinates: [number, number] };
  createdAt?: Date;
  updatedAt?: Date;

  constructor({_id = new ObjectId(), senderId, audioUrl = "", location = { type: "Point", coordinates: [0, 0] }, createdAt = new Date(), updatedAt} = {} as TTerminalEcho) {
    this._id = _id;
    this.senderId = senderId;
    this.audioUrl = audioUrl;
    this.location = location;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}