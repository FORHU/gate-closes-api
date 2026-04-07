import express from "express";
const router = express.Router();

import DtConversationCtrl from "../controllers/dt.conversation.controller";
import DtConversationMessageCtrl from "../controllers/dt.conversation.message.controller";
import DtConversationMessageReactionCtrl from "../controllers/dt.conversation.message.reaction.controller";

router.get("/conversations", DtConversationCtrl.listMyConversations);
router.post("/conversations/dm", DtConversationCtrl.createOrGetDm);
router.get("/conversations/:conversationId/messages", DtConversationMessageCtrl.list);
router.post("/conversations/:conversationId/messages", DtConversationMessageCtrl.send);
router.patch("/conversations/:conversationId/messages/:messageId/reaction", DtConversationMessageReactionCtrl.updateReaction);

export default router;
