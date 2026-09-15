import { Router } from "express";
import {
  getQuiz,
  modifyQuiz,
  removeQuiz,
  publish,
  addQuestion,
  createAttempt,
} from "../controllers/quiz.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";

export const quizRouter = Router();

// Single quiz endpoints
quizRouter.get("/:id", authenticate, getQuiz);
quizRouter.put("/:id", authenticate, authorizeRoles("FACULTY", "ADMIN"), modifyQuiz);
quizRouter.delete("/:id", authenticate, authorizeRoles("FACULTY", "ADMIN"), removeQuiz);
quizRouter.post("/:id/publish", authenticate, authorizeRoles("FACULTY", "ADMIN"), publish);

// Question creation under quiz
quizRouter.post("/:quizId/questions", authenticate, authorizeRoles("FACULTY", "ADMIN"), addQuestion);

// Student Quiz Attempts
quizRouter.post("/:id/attempts", authenticate, authorizeRoles("STUDENT"), createAttempt);
