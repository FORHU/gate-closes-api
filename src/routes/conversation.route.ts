import express from "express";
const router = express.Router();

import ConversationCtrl from "../controllers/conversation.controller";
import { idempotencyMiddleware } from "../middleware/idempotency.middleware";

router.get("/", ConversationCtrl.list);
router.post("/", idempotencyMiddleware, ConversationCtrl.create);
router.get("/search", ConversationCtrl.search);
router.get("/existence", ConversationCtrl.checkDmExists);
router.get("/:conversationId", ConversationCtrl.getById);
router.post("/:conversationId/read", ConversationCtrl.markRead);
router.get("/:conversationId/messages", ConversationCtrl.listMessages);
router.post("/:conversationId/messages", ConversationCtrl.sendMessage);
router.patch("/:conversationId/messages/:messageId/reaction", ConversationCtrl.updateReaction);

export default router;
