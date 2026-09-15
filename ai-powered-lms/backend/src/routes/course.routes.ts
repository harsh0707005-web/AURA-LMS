import { Router } from "express";
import {
  listCourses,
  getCourse,
  createNewCourse,
  modifyCourse,
  removeCourse,
  enroll,
  unenroll,
  listStudents,
} from "../controllers/course.controller.js";
import { listMaterials, addMaterial } from "../controllers/material.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { uploadMaterialPdf } from "../middleware/upload.middleware.js";

const router = Router();

// Publicly authenticated course browsing
router.get("/", authenticate, listCourses);
router.get("/:id", authenticate, getCourse);

// Course Management (Faculty & Admin)
router.post("/", authenticate, authorizeRoles("FACULTY", "ADMIN"), createNewCourse);
router.put("/:id", authenticate, authorizeRoles("FACULTY", "ADMIN"), modifyCourse);
router.delete("/:id", authenticate, authorizeRoles("FACULTY", "ADMIN"), removeCourse);

// Course Enrollment (Student only)
router.post("/:id/enroll", authenticate, authorizeRoles("STUDENT"), enroll);
router.delete("/:id/enroll", authenticate, authorizeRoles("STUDENT", "ADMIN"), unenroll);
router.get("/:id/students", authenticate, authorizeRoles("FACULTY", "ADMIN"), listStudents);

import { listAssignments, addAssignment } from "../controllers/assignment.controller.js";

// Course Assignments
router.get("/:courseId/assignments", authenticate, listAssignments);
router.post("/:courseId/assignments", authenticate, authorizeRoles("FACULTY", "ADMIN"), addAssignment);

import { listQuizzes, addQuiz } from "../controllers/quiz.controller.js";

// Course Quizzes
router.get("/:courseId/quizzes", authenticate, listQuizzes);
router.post("/:courseId/quizzes", authenticate, authorizeRoles("FACULTY", "ADMIN"), addQuiz);

// Course Materials (Supports JSON and PDF Multipart Uploads)
router.get("/:courseId/materials", authenticate, listMaterials);
router.post(
  "/:courseId/materials",
  authenticate,
  authorizeRoles("FACULTY", "ADMIN"),
  uploadMaterialPdf.single("file"),
  addMaterial
);

export default router;
