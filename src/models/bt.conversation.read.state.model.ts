import { ObjectId } from "mongodb";

export type TBtConversationReadState = {
  _id?: ObjectId;
  btConversationId: ObjectId;
  userId: ObjectId;
  lastReadAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
};

export class MBtConversationReadState implements Partial<TBtConversationReadState> {
  _id?: ObjectId;
  btConversationId: ObjectId;
  userId: ObjectId;
  lastReadAt: Date;
  createdAt?: Date;
  updatedAt?: Date;

  constructor({
    _id = new ObjectId(),
    btConversationId,
    userId,
    lastReadAt = new Date(),
    createdAt = new Date(),
    updatedAt = new Date(),
  } = {} as TBtConversationReadState) {
    this._id = _id;
    this.btConversationId = btConversationId;
    this.userId = userId;
    this.lastReadAt = lastReadAt;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}
