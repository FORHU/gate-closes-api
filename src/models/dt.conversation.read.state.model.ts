import { ObjectId } from "mongodb";

export type TDtConversationReadState = {
  _id?: ObjectId;
  dtConversationId: ObjectId;
  userId: ObjectId;
  lastReadAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
};

export class MDtConversationReadState implements Partial<TDtConversationReadState> {
  _id?: ObjectId;
  dtConversationId: ObjectId;
  userId: ObjectId;
  lastReadAt: Date;
  createdAt?: Date;
  updatedAt?: Date;

  constructor({
    _id = new ObjectId(),
    dtConversationId,
    userId,
    lastReadAt = new Date(),
    createdAt = new Date(),
    updatedAt = new Date(),
  } = {} as TDtConversationReadState) {
    this._id = _id;
    this.dtConversationId = dtConversationId;
    this.userId = userId;
    this.lastReadAt = lastReadAt;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}
