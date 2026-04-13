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

