import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/auth.types.js";
import { getParam } from "../lib/param.js";
import {
  getStudentAnalytics,
  getCourseAnalytics,
  getFacultyAnalytics,
  getAtRiskStudents,
} from "../services/analytics.service.js";

export async function studentAnalytics(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = getParam(req.params.id);
    const data = await getStudentAnalytics(id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function courseAnalytics(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = getParam(req.params.id);
    const data = await getCourseAnalytics(id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function facultyAnalytics(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = getParam(req.params.id);
    const data = await getFacultyAnalytics(id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function atRiskAnalytics(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await getAtRiskStudents();
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
