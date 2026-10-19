import { Router } from "express";
import {
  listConversations,
  getConversation,
  newConversation,
  removeConversation,
  sendMessage,
  getMessageRequest,
  generateQuiz,
} from "../controllers/ai.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { createRateLimiter } from "../middleware/security.middleware.js";

const router = Router();

router.use(authenticate);
router.use(createRateLimiter({ windowMs: 60 * 1000, max: 30, message: "Too many AI requests. Please try again shortly." }));

router.get("/conversations", listConversations);
router.post("/conversations", newConversation);
router.get("/conversations/:id", getConversation);
router.delete("/conversations/:id", removeConversation);
router.post("/conversations/:id/messages", sendMessage);
router.get("/conversations/:id/messages/requests/:key", getMessageRequest);
// Compatibility path used by the tutor client for post-abort reconciliation.
router.get("/conversations/:id/messages/status/:key", getMessageRequest);

// Syllabus-grounded AI Quiz Generator (Faculty & Admin)
router.post("/generate-quiz", authorizeRoles("FACULTY", "ADMIN"), generateQuiz);

export default router;
