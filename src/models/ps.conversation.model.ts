import { ObjectId } from "mongodb";

export type TPsConversation = {
  _id?: ObjectId;
  participants: ObjectId[];
  dmKey: string;
  lastEventType?: "message_sent" | "message_reacted" | "message_reaction_removed";
  lastEventAt?: Date;
  lastEventActorId?: ObjectId;
  lastEventActorName?: string;
  lastEventPayload?: Record<string, any> | null;
  lastEventText?: string;
  lastReadAt?: Date | null;
  hasUnread?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TPsConversationUpdateOptions = {
  _id?: ObjectId | string;
  participants?: ObjectId[];
  dmKey?: string;
  lastEventType?: "message_sent" | "message_reacted" | "message_reaction_removed";
  lastEventAt?: Date;
  lastEventActorId?: ObjectId | string;
  lastEventActorName?: string;
  lastEventPayload?: Record<string, any> | null;
  lastEventText?: string;
  lastReadAt?: Date | null;
  hasUnread?: boolean;
};

export class MPsConversation implements Partial<TPsConversation> {
  _id?: ObjectId;
  participants: ObjectId[];
  dmKey: string;
  lastEventType?: "message_sent" | "message_reacted" | "message_reaction_removed";
  lastEventAt?: Date;
  lastEventActorId?: ObjectId;
  lastEventActorName?: string;
  lastEventPayload?: Record<string, any> | null;
  lastEventText?: string;
  lastReadAt?: Date | null;
  hasUnread?: boolean;
  createdAt?: Date;
  updatedAt?: Date;

  constructor({
    _id = new ObjectId(),
    participants,
    dmKey = "",
    lastEventType,
    lastEventAt,
    lastEventActorId,
    lastEventActorName,
    lastEventPayload = null,
    lastEventText,
    lastReadAt = null,
    hasUnread = false,
    createdAt = new Date(),
    updatedAt,
  } = {} as TPsConversation) {
    this._id = _id;
    this.participants = participants;
    this.dmKey = dmKey;
    this.lastEventType = lastEventType;
    this.lastEventAt = lastEventAt;
    this.lastEventActorId = lastEventActorId;
    this.lastEventActorName = lastEventActorName;
    this.lastEventPayload = lastEventPayload;
    this.lastEventText = lastEventText;
    this.lastReadAt = lastReadAt;
    this.hasUnread = hasUnread;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}