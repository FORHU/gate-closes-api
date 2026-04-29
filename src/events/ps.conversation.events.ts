import { ObjectId } from "mongodb";
import { Server } from "socket.io";
import { verifyAccessToken } from "../utils/jwt";
import PsConversationRepo from "../repositories/ps.conversation.repository";

export default (io: Server) => {
  const nsp = io.of("/ps");

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
    const userId = socket.data.userId as string | undefined;
    if (userId) {
      socket.join(`user:${userId}`);
    }

    socket.on(
      "join_conversation",
      async ({ conversationId }: { conversationId: string }) => {
        try {
          const userId = socket.data.userId as string | undefined;
          if (!userId) {
            console.warn("[PS] join_conversation unauthorized");
            return;
          }

          const psUserId = new ObjectId(userId);
          const psConversationId = new ObjectId(conversationId);

          const convo = await PsConversationRepo.collection().findOne({
            _id: psConversationId,
            participants: psUserId,
          });

          if (!convo) {
            console.warn("[PS] join_conversation not a participant", {
              userId,
              conversationId,
            });
            return;
          }

          socket.join(conversationId);
          console.log("[PS] joined conversation", { userId, conversationId });
        } catch (err) {
          console.warn("[PS] join_conversation invalid conversationId", {
            conversationId,
            err,
          });
        }
      }
    );

    socket.on(
      "leave_conversation",
      ({ conversationId }: { conversationId: string }) => {
        socket.leave(conversationId);
        console.log("[PS] left conversation", {
          userId: socket.data.userId,
          conversationId,
        });
      }
    );
  });
};