import { ObjectId } from "mongodb";
import { ConversationType } from "../domain/conversation/conversation.types";

export type TConversationLatestEventType =
  | "message_sent"
  | "message_reacted"
  | "message_reaction_removed";

export type TConversation = {
  _id?: ObjectId;
  type: ConversationType;
  participants: ObjectId[];
  dmKey: string;
  lastEventType?: TConversationLatestEventType | string | null;
  lastEventAt?: Date | null;
  lastEventActorId?: ObjectId | null;
  lastEventActorName?: string | null;
  lastEventPayload?: Record<string, unknown> | null;
  lastEventText?: string | null;
  lastReadAt?: Date | null;
  hasUnread?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TConversationUpdateOptions = Partial<TConversation>;

export class MConversation implements Partial<TConversation> {
  _id?: ObjectId;
  type: ConversationType;
  participants: ObjectId[];
  dmKey: string;
  lastEventType?: TConversationLatestEventType | string | null;
  lastEventAt?: Date | null;
  lastEventActorId?: ObjectId | null;
  lastEventActorName?: string | null;
  lastEventPayload?: Record<string, unknown> | null;
  lastEventText?: string | null;
  lastReadAt?: Date | null;
  hasUnread?: boolean;
  createdAt?: Date;
  updatedAt?: Date;

  constructor(
    {
      _id = new ObjectId(),
      type = "parallel_soul",
      participants = [],
      dmKey = "",
      lastEventType = null,
      lastEventAt = null,
      lastEventActorId = null,
      lastEventActorName = null,
      lastEventPayload = null,
      lastEventText = null,
      lastReadAt = null,
      hasUnread = false,
      createdAt = new Date(),
      updatedAt,
    } = {} as TConversation
  ) {
    this._id = _id;
    this.type = type;
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
