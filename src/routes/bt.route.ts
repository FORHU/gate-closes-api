import express from "express";
const router = express.Router();

import BtConversationCtrl from "../controllers/bt.conversation.controller";
import BtConversationMessageCtrl from "../controllers/bt.conversation.message.controller";
import BtConversationMessageReactionCtrl from "../controllers/bt.conversation.message.reaction.controller";

router.get("/conversations", BtConversationCtrl.listMyConversations);
router.post("/conversations/dm", BtConversationCtrl.createOrGetDm);
router.get("/conversations/search", BtConversationCtrl.searchMyConversations);
router.get("/conversations/dm/existence", BtConversationCtrl.checkDmExists);
router.get("/conversations/:conversationId", BtConversationCtrl.getById);
router.post("/conversations/:conversationId/read", BtConversationCtrl.markRead);
router.get("/conversations/:conversationId/messages", BtConversationMessageCtrl.list);
router.post("/conversations/:conversationId/messages", BtConversationMessageCtrl.send);
router.patch("/conversations/:conversationId/messages/:messageId/reaction", BtConversationMessageReactionCtrl.updateReaction);

export default router;
