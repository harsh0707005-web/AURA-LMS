import { Router } from "express";
import { getAttempt, createAttempt } from "../controllers/quiz.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";

const router = Router();

router.get("/:id", authenticate, getAttempt);
router.post("/:id/submit", authenticate, authorizeRoles("STUDENT"), createAttempt);

export default router;
