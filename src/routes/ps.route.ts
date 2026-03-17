import express from "express";
const router = express.Router();

import PsConversationCtrl from "../controllers/ps.conversation.controller";
import PsConversationMessageCtrl from "../controllers/ps.conversation.message.controller";
import PsMatchCtrl from "../controllers/ps.match.controller";

router.get("/conversations", PsConversationCtrl.listMyConversations);
router.get("/conversations/eligible-users", PsConversationCtrl.listEligibleUsers);
router.post("/conversations/dm", PsConversationCtrl.createOrGetDm);
router.get("/conversations/:conversationId/messages", PsConversationMessageCtrl.list);
router.post("/conversations/:conversationId/messages", PsConversationMessageCtrl.send);
router.patch("/conversations/:conversationId/messages/:messageId/reaction", PsConversationMessageCtrl.updateReaction);
router.post("/match/swipe", PsMatchCtrl.swipe);

export default router;
