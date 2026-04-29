export const TERMINAL_ECHO_TYPE = {
  PARALLEL_SOUL: "parallel_soul",
  DESTINATION_THREAD: "destination_thread",
  BATON_TOUCH: "baton_touch",
  TERMINAL_ECHO: "terminal_echo",
} as const;

export type TerminalEchoType =
  (typeof TERMINAL_ECHO_TYPE)[keyof typeof TERMINAL_ECHO_TYPE];

export type TerminalEchoMapBounds = [[number, number], [number, number]];

export const ERROR_MESSAGE = {
  INVALID_USER_ID: "Invalid user id.",
  INVALID_CONVERSATION_ID: "Invalid conversation id.",
  INVALID_OTHER_USER_ID: "Invalid other user id.",
} as const;

export const PS_SOCKET_EVENT = {
  CONVERSATION_READ_STATE_UPDATED: "ps:conversation_read_state_updated",
} as const;

export type TPsConversationReadStateSocketPayload =
  | {
      kind: "read";
      conversationId: string;
      userId: string;
      serverTs: string;
      lastReadAt: Date;
      hasUnread: false;
    }
  | {
      kind: "latest_event";
      conversationId: string;
      userId: string;
      serverTs: string;
      lastEventAt: Date | null;
      lastEventActorId: string | null;
      lastEventType: "message_sent" | "message_reacted" | "message_reaction_removed" | null;
      lastEventText: string | null;
      hasUnread: boolean;
    };

