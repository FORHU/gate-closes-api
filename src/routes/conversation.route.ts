import express from "express";
const router = express.Router();

import ConversationCtrl from "../controllers/conversation.controller";

router.get("/", ConversationCtrl.list);
router.post("/", ConversationCtrl.create);
router.get("/search", ConversationCtrl.search);
router.get("/existence", ConversationCtrl.checkDmExists);
router.get("/:conversationId", ConversationCtrl.getById);
router.post("/:conversationId/read", ConversationCtrl.markRead);

export default router;
