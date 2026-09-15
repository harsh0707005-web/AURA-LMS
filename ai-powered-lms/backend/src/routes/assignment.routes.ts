import { Router } from "express";
import {
  getAssignment,
  modifyAssignment,
  removeAssignment,
  submit,
  listSubmissions,
  getSubmission,
  grade,
} from "../controllers/assignment.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";

export const assignmentRouter = Router();

// Single assignment endpoints
assignmentRouter.get("/:id", authenticate, getAssignment);
assignmentRouter.put("/:id", authenticate, authorizeRoles("FACULTY", "ADMIN"), modifyAssignment);
assignmentRouter.delete("/:id", authenticate, authorizeRoles("FACULTY", "ADMIN"), removeAssignment);

// Submissions under assignment
assignmentRouter.post("/:id/submissions", authenticate, authorizeRoles("STUDENT"), submit);
assignmentRouter.get("/:id/submissions", authenticate, authorizeRoles("FACULTY", "ADMIN"), listSubmissions);

export const submissionRouter = Router();

// Submission direct endpoints
submissionRouter.get("/:id", authenticate, getSubmission);
submissionRouter.put("/:id/grade", authenticate, authorizeRoles("FACULTY", "ADMIN"), grade);
