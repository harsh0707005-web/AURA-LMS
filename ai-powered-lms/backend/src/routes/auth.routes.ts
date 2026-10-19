import { Router } from "express";
import {
  register,
  login,
  getMe,
  logout,
  verifyEmail,
  resendEmail,
} from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { createRateLimiter } from "../middleware/security.middleware.js";

const router = Router();

const authRateLimit = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10, message: "Too many authentication attempts. Please try again later." });

router.post("/register", authRateLimit, register);
router.post("/verify-email", authRateLimit, verifyEmail);
router.post("/resend-verification", authRateLimit, resendEmail);
router.post("/login", authRateLimit, login);
router.get("/me", authenticate, getMe);
router.post("/logout", logout);

export default router;
