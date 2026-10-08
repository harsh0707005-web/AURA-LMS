import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/auth.types.js";
import { getParam } from "../lib/param.js";
import {
  getUserConversations,
  getConversationById,
  createConversation,
  deleteConversation,
  postMessageToConversation,
} from "../services/ai.service.js";

export async function listConversations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const conversations = await getUserConversations(req.user.userId);
    res.status(200).json({ success: true, data: conversations });
  } catch (error) {
    next(error);
  }
}

export async function getConversation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const id = getParam(req.params.id);
    const conversation = await getConversationById(id, req.user.userId);
    res.status(200).json({ success: true, data: conversation });
  } catch (error) {
    next(error);
  }
}

export async function newConversation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const created = await createConversation(req.user.userId, req.body);
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    next(error);
  }
}

export async function removeConversation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const id = getParam(req.params.id);
    const result = await deleteConversation(id, req.user.userId);
    res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    next(error);
  }
}

export async function sendMessage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const id = getParam(req.params.id);
    const result = await postMessageToConversation(id, req.user.userId, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

import { generateQuizQuestions } from "../services/ai/quiz-generator.service.js";
import { GenerateQuizInput } from "../types/academic.types.js";

/**
 * Controller endpoint for generating and previewing or publishing syllabus-grounded quizzes.
 * Performs complete runtime validation on all request body parameters.
 * Supports Idempotency-Key headers to prevent duplicate quiz publications.
 */
export async function generateQuiz(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      res.status(400).json({ success: false, message: "Request body must be a valid JSON object" });
      return;
    }

    const {
      courseId,
      topic,
      difficulty,
      questionCount,
      materialIds,
      saveImmediately,
      timeLimitMinutes,
      fallbackAcknowledged,
    } = req.body;

    if (!courseId || typeof courseId !== "string" || !courseId.trim()) {
      res.status(400).json({ success: false, message: "courseId is required and must be a non-empty string" });
      return;
    }

    if (!topic || typeof topic !== "string" || !topic.trim()) {
      res.status(400).json({ success: false, message: "topic is required and must be a non-empty string" });
      return;
    }

    if (difficulty !== undefined) {
      if (typeof difficulty !== "string" || !["Easy", "Medium", "Hard"].includes(difficulty)) {
        res.status(400).json({
          success: false,
          message: "difficulty must be one of: Easy, Medium, Hard",
        });
        return;
      }
    }

    if (questionCount !== undefined) {
      if (
        typeof questionCount !== "number" ||
        !Number.isInteger(questionCount) ||
        questionCount < 1 ||
        questionCount > 10
      ) {
        res.status(400).json({
          success: false,
          message: "questionCount must be an integer between 1 and 10",
        });
        return;
      }
    }

    if (timeLimitMinutes !== undefined) {
      if (
        typeof timeLimitMinutes !== "number" ||
        !Number.isInteger(timeLimitMinutes) ||
        timeLimitMinutes < 5 ||
        timeLimitMinutes > 180
      ) {
        res.status(400).json({
          success: false,
          message: "timeLimitMinutes must be an integer between 5 and 180",
        });
        return;
      }
    }

    if (materialIds !== undefined) {
      if (
        !Array.isArray(materialIds) ||
        !materialIds.every((id: unknown) => typeof id === "string" && id.trim().length > 0)
      ) {
        res.status(400).json({
          success: false,
          message: "materialIds must be an array of non-empty string identifiers",
        });
        return;
      }
    }

    if (saveImmediately !== undefined && typeof saveImmediately !== "boolean") {
      res.status(400).json({
        success: false,
        message: "saveImmediately must be a boolean",
      });
      return;
    }

    if (fallbackAcknowledged !== undefined && typeof fallbackAcknowledged !== "boolean") {
      res.status(400).json({
        success: false,
        message: "fallbackAcknowledged must be a boolean",
      });
      return;
    }

    const headerIdempotencyKey = req.headers["idempotency-key"];
    const idempotencyKey =
      (typeof headerIdempotencyKey === "string" && headerIdempotencyKey.trim()) ||
      (typeof req.body.idempotencyKey === "string" && req.body.idempotencyKey.trim()) ||
      undefined;

    const validatedInput: GenerateQuizInput = {
      courseId: courseId.trim(),
      topic: topic.trim(),
      ...(difficulty && { difficulty }),
      ...(questionCount !== undefined && { questionCount }),
      ...(materialIds && { materialIds }),
      ...(saveImmediately !== undefined && { saveImmediately }),
      ...(timeLimitMinutes !== undefined && { timeLimitMinutes }),
      ...(fallbackAcknowledged !== undefined && { fallbackAcknowledged }),
      ...(idempotencyKey && { idempotencyKey }),
    };

    const result = await generateQuizQuestions(validatedInput, req.user.userId, req.user.role);
    const statusCode = validatedInput.saveImmediately ? 201 : 200;

    res.status(statusCode).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
