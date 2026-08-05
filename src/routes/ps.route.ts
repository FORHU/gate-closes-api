import express from "express";
const router = express.Router();

import PsConversationCtrl from "../controllers/ps.conversation.controller";
import PsConversationMessageCtrl from "../controllers/ps.conversation.message.controller";
import PsConversationMessageReactionCtrl from "../controllers/ps.conversation.message.reaction.controller";

router.get("/conversations", PsConversationCtrl.listMyConversations);
router.post("/conversations", PsConversationCtrl.create);
router.get("/conversations/search", PsConversationCtrl.searchMyConversations);
router.get("/conversations/dm/existence", PsConversationCtrl.checkDmExists);
router.get("/conversations/:conversationId", PsConversationCtrl.getById);
router.post("/conversations/:conversationId/read", PsConversationCtrl.markRead);
router.get("/conversations/:conversationId/messages", PsConversationMessageCtrl.list);
router.post("/conversations/:conversationId/messages", PsConversationMessageCtrl.send);
router.patch("/conversations/:conversationId/messages/:messageId/reaction", PsConversationMessageReactionCtrl.updateReaction);

export default router;
