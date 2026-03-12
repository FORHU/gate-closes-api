import express from "express";
const router = express.Router();

import PsConversationCtrl from "../controllers/ps.conversation.controller";
import PsConversationMessageCtrl from "../controllers/ps.conversation.message.controller";

router.get("/conversations", PsConversationCtrl.listMyConversations);
router.get("/conversations/eligible-users", PsConversationCtrl.listEligibleUsers);
router.post("/conversations/dm", PsConversationCtrl.createOrGetDm);
router.get("/conversations/:conversationId/messages", PsConversationMessageCtrl.list);
router.post("/conversations/:conversationId/messages",PsConversationMessageCtrl.send);

export default router;

