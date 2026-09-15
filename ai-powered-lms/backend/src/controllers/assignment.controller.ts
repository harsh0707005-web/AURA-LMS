import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/auth.types.js";
import { getParam } from "../lib/param.js";
import {
  getAssignmentsByCourse,
  getAssignmentById,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  submitAssignment,
  getSubmissionsByAssignment,
  getSubmissionById,
  gradeSubmission,
} from "../services/assignment.service.js";

export async function listAssignments(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const courseId = getParam(req.params.courseId);
    const studentId = req.user?.role === "STUDENT" ? req.user.userId : undefined;
    const assignments = await getAssignmentsByCourse(courseId, studentId);

    res.status(200).json({
      success: true,
      data: assignments,
    });
  } catch (error) {
    next(error);
  }
}

export async function getAssignment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = getParam(req.params.id);
    const studentId = req.user?.role === "STUDENT" ? req.user.userId : undefined;
    const assignment = await getAssignmentById(id, studentId);

    res.status(200).json({
      success: true,
      data: assignment,
    });
  } catch (error) {
    next(error);
  }
}

export async function addAssignment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const courseId = getParam(req.params.courseId);
    const assignment = await createAssignment(courseId, req.body, req.user.userId, req.user.role);

    res.status(201).json({
      success: true,
      message: "Assignment created successfully",
      data: assignment,
    });
  } catch (error) {
    next(error);
  }
}

export async function modifyAssignment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const id = getParam(req.params.id);
    const updated = await updateAssignment(id, req.body, req.user.userId, req.user.role);

    res.status(200).json({
      success: true,
      message: "Assignment updated successfully",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

export async function removeAssignment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const id = getParam(req.params.id);
    const result = await deleteAssignment(id, req.user.userId, req.user.role);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
}

export async function submit(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const id = getParam(req.params.id);
    const submission = await submitAssignment(id, req.user.userId, req.body);

    res.status(201).json({
      success: true,
      message: "Assignment solution submitted successfully",
      data: submission,
    });
  } catch (error) {
    next(error);
  }
}

export async function listSubmissions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const id = getParam(req.params.id);
    const submissions = await getSubmissionsByAssignment(id, req.user.userId, req.user.role);

    res.status(200).json({
      success: true,
      data: submissions,
    });
  } catch (error) {
    next(error);
  }
}

export async function getSubmission(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const id = getParam(req.params.id);
    const submission = await getSubmissionById(id, req.user.userId, req.user.role);

    res.status(200).json({
      success: true,
      data: submission,
    });
  } catch (error) {
    next(error);
  }
}

export async function grade(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const id = getParam(req.params.id);
    const result = await gradeSubmission(id, req.body, req.user.userId, req.user.role);

    res.status(200).json({
      success: true,
      message: "Submission graded successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
