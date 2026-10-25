import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/auth.types.js";
import { getParam } from "../lib/param.js";
import {
  createAnnouncement,
  listAnnouncementsForUser,
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/announcement.service.js";

export async function listAnnouncements(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }
    res.status(200).json({ success: true, data: await listAnnouncementsForUser(req.user.userId, req.user.role) });
  } catch (error) {
    next(error);
  }
}

export async function createNewAnnouncement(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }
    const announcement = await createAnnouncement(req.body || {}, req.user.userId, req.user.role);
    res.status(201).json({ success: true, message: "Announcement published", data: announcement });
  } catch (error) {
    next(error);
  }
}

export async function listNotifications(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }
    res.status(200).json({ success: true, data: await listNotificationsForUser(req.user.userId) });
  } catch (error) {
    next(error);
  }
}

export async function readNotification(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }
    res.status(200).json({ success: true, ...(await markNotificationRead(getParam(req.params.id), req.user.userId)) });
  } catch (error) {
    next(error);
  }
}

export async function readAllNotifications(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }
    res.status(200).json({ success: true, ...(await markAllNotificationsRead(req.user.userId)) });
  } catch (error) {
    next(error);
  }
}
