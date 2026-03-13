import { Server } from "socket.io";
import organizationEvents from "./organization.events";
import psConversationEvents from "./ps.conversation.events";
export default function events(io: Server) {
  organizationEvents(io);
  psConversationEvents(io);
}
