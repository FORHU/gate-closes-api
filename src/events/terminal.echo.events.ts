import { Server } from "socket.io";
import { verifyAccessToken } from "../utils/jwt";

export default (io: Server) => {
  const nsp = io.of("/terminal-echo");

  nsp.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ??
        socket.handshake.headers.authorization?.split(" ")[1];

      if (!token) return next(new Error("Unauthorized"));

      const payload = verifyAccessToken(token);
      socket.data.userId = payload.userId;
      return next();
    } catch {
      return next(new Error("Unauthorized"));
    }
  });

  nsp.on("connection", (socket) => {
    socket.on("terminal_echo:join_map", ({ room }: { room: string }) => {
      socket.join(room);
    });

    socket.on("terminal_echo:leave_map", ({ room }: { room: string }) => {
      socket.leave(room);
    });
  });
};