import { ObjectId } from "mongodb";

export type TDtConversation = {
  _id?: ObjectId;
  participants: ObjectId[];
  dmKey: string;
  createdAt?: Date;
  updatedAt?: Date;
  lastEventType?: "message_sent" | "message_reacted" | "message_reaction_removed";
  lastEventAt?: Date;
  lastEventActorId?: ObjectId;
  lastEventActorName?: string;
  lastEventPayload?: Record<string, unknown> | null;
  lastEventText?: string; 
};

export type TDtConversationUpdateOptions = {
  _id?: ObjectId | string;
  participants?: ObjectId[];
  dmKey?: string;
};

export class MDtConversation implements Partial<TDtConversation> {
  _id?: ObjectId;
  participants: ObjectId[];
  dmKey: string;
  createdAt?: Date;
  updatedAt?: Date;
  lastEventType?: "message_sent" | "message_reacted" | "message_reaction_removed";
  lastEventAt?: Date;
  lastEventActorId?: ObjectId;
  lastEventActorName?: string;
  lastEventPayload?: Record<string, unknown> | null;
  lastEventText?: string;

  constructor({
    _id = new ObjectId(),
    participants,
    dmKey = "",
    createdAt = new Date(),
    updatedAt,
    lastEventType,
    lastEventAt,
    lastEventActorId,
    lastEventActorName,
    lastEventPayload = null,
    lastEventText,
  } = {} as TDtConversation) {
    this._id = _id;
    this.participants = participants;
    this.dmKey = dmKey;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.lastEventType = lastEventType;
    this.lastEventAt = lastEventAt;
    this.lastEventActorId = lastEventActorId;
    this.lastEventActorName = lastEventActorName;
    this.lastEventPayload = lastEventPayload;
    this.lastEventText = lastEventText;
  }
}