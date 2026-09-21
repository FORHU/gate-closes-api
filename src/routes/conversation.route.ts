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

export default router;
