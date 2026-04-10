import { ObjectId } from "mongodb";
import { Server } from "socket.io";
import { verifyAccessToken } from "../utils/jwt";
import BtConversationRepo from "../repositories/bt.conversation.repository";

export default (io: Server) => {
  const nsp = io.of("/bt");

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
    socket.on(
      "join_conversation",
      async ({ conversationId }: { conversationId: string }) => {
        try {
          const userId = socket.data.userId as string | undefined;
          if (!userId) {
            console.warn("[Bt] join_conversation unauthorized");
            return;
          }

          const btUserId = new ObjectId(userId);
          const btConversationId = new ObjectId(conversationId);

          const convo = await BtConversationRepo.collection().findOne({
            _id: btConversationId,
            participants: btUserId,
          });

          if (!convo) {
            console.warn("[Bt] join_conversation not a participant", {
              userId,
              conversationId,
            });
            return;
          }

          socket.join(conversationId);
          console.log("[Bt] joined conversation", { userId, conversationId });
        } catch (err) {
          console.warn("[Bt] join_conversation invalid conversationId", {
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
        console.log("[BT] left conversation", {
          userId: socket.data.userId,
          conversationId,
        });
      }
    );
  });
};