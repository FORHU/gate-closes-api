import { Server } from "socket.io";
import organizationEvents from "./organization.events";
import terminalEchoEvents from "./terminal.echo.events";
import conversationEvents from "./conversation.events";

export default function events(io: Server) {
  organizationEvents(io);
  terminalEchoEvents(io);
  conversationEvents(io);
}
