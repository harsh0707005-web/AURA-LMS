import { Router } from "express";
import {
  listConversations,
  getConversation,
  newConversation,
  removeConversation,
  sendMessage,
} from "../controllers/ai.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/conversations", listConversations);
router.post("/conversations", newConversation);
router.get("/conversations/:id", getConversation);
router.delete("/conversations/:id", removeConversation);
router.post("/conversations/:id/messages", sendMessage);

export default router;
