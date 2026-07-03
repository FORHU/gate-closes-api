import { Server } from "socket.io";
import organizationEvents from "./organization.events";
import terminalEchoEvents from "./terminal.echo.events";
import psConversationEvents from "./ps.conversation.events";
import dtConversationEvents from "./dt.conversation.events";
import btConversationEvents from "./bt.conversation.events";

export default function events(io: Server) {
  organizationEvents(io);
  terminalEchoEvents(io);
  psConversationEvents(io);
  dtConversationEvents(io);
  btConversationEvents(io);
}