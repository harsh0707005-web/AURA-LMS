import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/auth.types.js";
import { getParam } from "../lib/param.js";
import {
  getAllCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
  enrollStudentInCourse,
  unenrollStudentFromCourse,
  getCourseStudents,
} from "../services/course.service.js";

export async function listCourses(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { department, semester, facultyId } = req.query;
    const courses = await getAllCourses({
      department: department ? String(department) : undefined,
      semester: semester ? Number(semester) : undefined,
      facultyId: facultyId ? String(facultyId) : undefined,
    });

    res.status(200).json({
      success: true,
      data: courses,
    });
  } catch (error) {
    next(error);
  }
}

export async function getCourse(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = getParam(req.params.id);
    const course = await getCourseById(id);

    res.status(200).json({
      success: true,
      data: course,
    });
  } catch (error) {
    next(error);
  }
}

export async function createNewCourse(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const newCourse = await createCourse(req.body || {}, req.user.userId);

    res.status(201).json({
      success: true,
      message: "Course created successfully",
      data: newCourse,
    });
  } catch (error) {
    next(error);
  }
}

export async function modifyCourse(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const id = getParam(req.params.id);
    const updated = await updateCourse(id, req.body || {}, req.user.userId, req.user.role);

    res.status(200).json({
      success: true,
      message: "Course updated successfully",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

export async function removeCourse(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const id = getParam(req.params.id);
    const result = await deleteCourse(id, req.user.userId, req.user.role);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
}

export async function enroll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    if (req.user.role !== "STUDENT") {
      res.status(403).json({ success: false, message: "Only students can enroll in courses" });
      return;
    }

    const courseId = getParam(req.params.id || req.params.courseId);
    if (!courseId) {
      res.status(400).json({ success: false, message: "Course ID is required" });
      return;
    }

    const studentId = req.user.userId;
    const enrollment = await enrollStudentInCourse(studentId, courseId);

    res.status(201).json({
      success: true,
      message: "Enrolled in course successfully",
      data: enrollment,
    });
  } catch (error) {
    next(error);
  }
}

export async function unenroll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    if (req.user.role !== "STUDENT" && req.user.role !== "ADMIN") {
      res.status(403).json({ success: false, message: "Only students can unenroll from courses" });
      return;
    }

    const courseId = getParam(req.params.id || req.params.courseId);
    if (!courseId) {
      res.status(400).json({ success: false, message: "Course ID is required" });
      return;
    }

    const studentId = req.user.userId;
    const result = await unenrollStudentFromCourse(studentId, courseId);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
}

export async function listStudents(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = getParam(req.params.id);
    const students = await getCourseStudents(id);

    res.status(200).json({
      success: true,
      data: students,
    });
  } catch (error) {
    next(error);
  }
}
