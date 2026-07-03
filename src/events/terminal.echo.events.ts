import { Server } from "socket.io";
import { verifyAccessToken } from "../utils/jwt";

export default (io: Server) => {
  const nsp = io.of("/terminal-echo");

  nsp.use((socket, next) => {
    try {
      // Prefer the raw (unprefixed) accessToken the client sends,
      // fall back to the header-derived token (already split from "Bearer ").
      // Do NOT use handshake.auth.token directly — it still has the
      // "Bearer " prefix and will fail verification unstripped.
      const rawAuthToken = socket.handshake.auth?.accessToken;
      const headerToken = socket.handshake.headers.authorization?.split(" ")[1];
      const token = rawAuthToken ?? headerToken;

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