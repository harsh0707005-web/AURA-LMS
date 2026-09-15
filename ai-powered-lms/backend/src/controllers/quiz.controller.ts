import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/auth.types.js";
import { getParam } from "../lib/param.js";
import {
  getQuizzesByCourse,
  getQuizById,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  publishQuiz,
  addQuestionToQuiz,
  submitQuizAttempt,
  getAttemptById,
  getStudentQuizAttempts,
} from "../services/quiz.service.js";

export async function listQuizzes(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const courseId = getParam(req.params.courseId);
    const role = req.user?.role || "STUDENT";
    const quizzes = await getQuizzesByCourse(courseId, role);

    res.status(200).json({
      success: true,
      data: quizzes,
    });
  } catch (error) {
    next(error);
  }
}

export async function getQuiz(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = getParam(req.params.id);
    const role = req.user?.role || "STUDENT";
    const quiz = await getQuizById(id, role);

    res.status(200).json({
      success: true,
      data: quiz,
    });
  } catch (error) {
    next(error);
  }
}

export async function addQuiz(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const courseId = getParam(req.params.courseId);
    const quiz = await createQuiz(courseId, req.body, req.user.userId, req.user.role);

    res.status(201).json({
      success: true,
      message: "Quiz created successfully",
      data: quiz,
    });
  } catch (error) {
    next(error);
  }
}

export async function modifyQuiz(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const id = getParam(req.params.id);
    const updated = await updateQuiz(id, req.body, req.user.userId, req.user.role);

    res.status(200).json({
      success: true,
      message: "Quiz updated successfully",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

export async function removeQuiz(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const id = getParam(req.params.id);
    const result = await deleteQuiz(id, req.user.userId, req.user.role);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
}

export async function publish(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const id = getParam(req.params.id);
    const publishedQuiz = await publishQuiz(id, req.user.userId, req.user.role);

    res.status(200).json({
      success: true,
      message: "Quiz published to students",
      data: publishedQuiz,
    });
  } catch (error) {
    next(error);
  }
}

export async function addQuestion(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const quizId = getParam(req.params.quizId);
    const question = await addQuestionToQuiz(quizId, req.body, req.user.userId, req.user.role);

    res.status(201).json({
      success: true,
      message: "Question added successfully",
      data: question,
    });
  } catch (error) {
    next(error);
  }
}

export async function createAttempt(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const id = getParam(req.params.id);
    const result = await submitQuizAttempt(id, req.user.userId, req.body);

    res.status(201).json({
      success: true,
      message: "Quiz submitted and evaluated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getAttempt(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const id = getParam(req.params.id);
    const attempt = await getAttemptById(id, req.user.userId, req.user.role);

    res.status(200).json({
      success: true,
      data: attempt,
    });
  } catch (error) {
    next(error);
  }
}

export async function listStudentAttempts(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = getParam(req.params.id);
    const attempts = await getStudentQuizAttempts(id);

    res.status(200).json({
      success: true,
      data: attempts,
    });
  } catch (error) {
    next(error);
  }
}
