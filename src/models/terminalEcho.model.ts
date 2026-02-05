import { ObjectId } from "mongodb";

export type TTerminalEcho = {
  _id?: ObjectId;
  senderId: ObjectId;
  audioUrl?: string;
  location?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export class MTerminalEcho implements Partial<TTerminalEcho> {
  _id?: ObjectId;
  senderId: ObjectId;
  audioUrl?: string;
  location?: string;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(
    {
      _id = new ObjectId(),
      senderId = new ObjectId(),
      audioUrl = "",
      location = "",
      createdAt = new Date(),
      updatedAt,
    } = {} as TTerminalEcho,
  ) {
    this._id = _id;
    this.senderId = senderId;
    this.audioUrl = audioUrl;
    this.location = location;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

