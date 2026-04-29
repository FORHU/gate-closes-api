import { ObjectId } from "mongodb";

export type TPsConversationReadState = {
  _id?: ObjectId;
  psConversationId: ObjectId;
  userId: ObjectId;
  lastReadAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
};

export class MPsConversationReadState implements Partial<TPsConversationReadState> {
  _id?: ObjectId;
  psConversationId: ObjectId;
  userId: ObjectId;
  lastReadAt: Date;
  createdAt?: Date;
  updatedAt?: Date;

  constructor({
    _id = new ObjectId(),
    psConversationId,
    userId,
    lastReadAt = new Date(),
    createdAt = new Date(),
    updatedAt = new Date(),
  } = {} as TPsConversationReadState) {
    this._id = _id;
    this.psConversationId = psConversationId;
    this.userId = userId;
    this.lastReadAt = lastReadAt;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}
