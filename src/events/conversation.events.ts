import { ObjectId } from "mongodb";
import { Server } from "socket.io";
import { verifyAccessToken } from "../utils/jwt";
import ConversationRepo from "../repositories/conversation.repository";

export default (io: Server) => {
  const nsp = io.of("/conversations");

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
          if (!userId) return;

          const userObjectId = new ObjectId(userId);
          const convoObjectId = new ObjectId(conversationId);

          const convo = await ConversationRepo.collection().findOne({
            _id: convoObjectId,
            participants: userObjectId,
          });

          if (!convo) {
            console.warn("[Conversations] join_conversation not a participant", {
              userId,
              conversationId,
            });
            return;
          }

          socket.join(conversationId);
        } catch (err) {
          console.warn("[Conversations] join_conversation invalid conversationId", {
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
      }
    );
  });
};
