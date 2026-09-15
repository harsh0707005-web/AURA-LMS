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
