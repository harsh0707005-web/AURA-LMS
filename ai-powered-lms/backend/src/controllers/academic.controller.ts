import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/auth.types.js";
import { getParam } from "../lib/param.js";
import {
  getAllStudents,
  getStudentById,
  getStudentCourses,
  getStudentPerformance,
  getStudentRecommendations,
  getStudentWeakTopics,
  getAllFaculty,
  getFacultyById,
  getFacultyCourses,
} from "../services/academic.service.js";
import { getStudentQuizAttempts } from "../services/quiz.service.js";

// Student Handlers
export async function listStudents(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const students = await getAllStudents();
    res.status(200).json({ success: true, data: students });
  } catch (error) {
    next(error);
  }
}

export async function getStudent(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = getParam(req.params.id);
    const student = await getStudentById(id);
    res.status(200).json({ success: true, data: student });
  } catch (error) {
    next(error);
  }
}

export async function listStudentCourses(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = getParam(req.params.id);
    const courses = await getStudentCourses(id);
    res.status(200).json({ success: true, data: courses });
  } catch (error) {
    next(error);
  }
}

export async function getPerformance(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = getParam(req.params.id);
    const performance = await getStudentPerformance(id);
    res.status(200).json({ success: true, data: performance });
  } catch (error) {
    next(error);
  }
}

export async function getRecommendations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = getParam(req.params.id);
    const recs = await getStudentRecommendations(id);
    res.status(200).json({ success: true, data: recs });
  } catch (error) {
    next(error);
  }
}

export async function getWeakTopics(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = getParam(req.params.id);
    const topics = await getStudentWeakTopics(id);
    res.status(200).json({ success: true, data: topics });
  } catch (error) {
    next(error);
  }
}

export async function getQuizAttempts(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = getParam(req.params.id);
    const attempts = await getStudentQuizAttempts(id);
    res.status(200).json({ success: true, data: attempts });
  } catch (error) {
    next(error);
  }
}

// Faculty Handlers
export async function listFaculty(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const faculty = await getAllFaculty();
    res.status(200).json({ success: true, data: faculty });
  } catch (error) {
    next(error);
  }
}

export async function getFaculty(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = getParam(req.params.id);
    const faculty = await getFacultyById(id);
    res.status(200).json({ success: true, data: faculty });
  } catch (error) {
    next(error);
  }
}

export async function listFacultyCourses(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = getParam(req.params.id);
    const courses = await getFacultyCourses(id);
    res.status(200).json({ success: true, data: courses });
  } catch (error) {
    next(error);
  }
}
