import { Router } from "express";
import { getAttempt, createAttempt } from "../controllers/quiz.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/:id", authenticate, getAttempt);
router.post("/:id/submit", authenticate, createAttempt);

export default router;
