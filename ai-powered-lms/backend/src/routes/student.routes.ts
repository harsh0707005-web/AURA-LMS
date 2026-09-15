import { Router } from "express";
import {
  listStudents,
  getStudent,
  listStudentCourses,
  getPerformance,
  getRecommendations,
  getWeakTopics,
  getQuizAttempts,
} from "../controllers/academic.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles, authorizeStudentAccess } from "../middleware/role.middleware.js";

const router = Router();

// Roster listing restricted to Faculty and Admin
router.get("/", authenticate, authorizeRoles("FACULTY", "ADMIN"), listStudents);

// Student-specific endpoints protected with ID-level ownership isolation
router.get("/:id", authenticate, authorizeStudentAccess("id"), getStudent);
router.get("/:id/courses", authenticate, authorizeStudentAccess("id"), listStudentCourses);
router.get("/:id/performance", authenticate, authorizeStudentAccess("id"), getPerformance);
router.get("/:id/recommendations", authenticate, authorizeStudentAccess("id"), getRecommendations);
router.get("/:id/weak-topics", authenticate, authorizeStudentAccess("id"), getWeakTopics);
router.get("/:id/quiz-attempts", authenticate, authorizeStudentAccess("id"), getQuizAttempts);

export default router;

