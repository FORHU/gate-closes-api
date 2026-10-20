import { ObjectId } from "mongodb";

export type TConversationMessage = {
  _id?: ObjectId;
  conversationId: ObjectId;
  senderId: ObjectId;
  fileId?: ObjectId | null;
  textMessage?: string;
  reactions?: Record<string, number>;
  createdAt?: Date;
  updatedAt?: Date;
};

export class MConversationMessage {
  _id?: ObjectId;
  conversationId: ObjectId;
  senderId: ObjectId;
  fileId?: ObjectId | null;
  textMessage: string;
  reactions: Record<string, number>;
  createdAt: Date;
  updatedAt: Date;

  constructor(message: TConversationMessage) {
    if (message._id) this._id = message._id;
    this.conversationId = message.conversationId;
    this.senderId = message.senderId;
    this.fileId = message.fileId ?? null;
    this.textMessage = message.textMessage ?? "";
    this.reactions = message.reactions ?? {};
    this.createdAt = message.createdAt ?? new Date();
    this.updatedAt = message.updatedAt ?? new Date();
  }
}
