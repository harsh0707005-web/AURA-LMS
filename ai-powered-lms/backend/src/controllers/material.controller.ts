import { Response, NextFunction } from "express";
import { pipeline } from "node:stream";
import { AuthRequest } from "../types/auth.types.js";
import { getParam } from "../lib/param.js";
import {
  getMaterialsByCourse,
  getMaterialById,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  getMaterialChunks,
  getMaterialFile,
  getStudentMaterialProgress,
  updateStudentMaterialProgress,
} from "../services/material.service.js";

export async function listMaterials(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const courseId = getParam(req.params.courseId);
    const studentId = req.user?.role === "STUDENT" ? req.user.userId : undefined;
    const materials = await getMaterialsByCourse(courseId, studentId);

    res.status(200).json({
      success: true,
      data: materials,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMaterial(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = getParam(req.params.id);
    const studentId = req.user?.role === "STUDENT" ? req.user.userId : undefined;
    const material = await getMaterialById(id, studentId);

    res.status(200).json({
      success: true,
      data: material,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Streams the protected course material PDF to authorized clients.
 */
export async function streamMaterialFile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const id = getParam(req.params.id);
    const fileInfo = await getMaterialFile(id, req.user.userId, req.user.role);

    const safeTitle = fileInfo.title.replace(/[^a-zA-Z0-9_-]/g, "_");
    res.setHeader("Content-Type", fileInfo.contentType || "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${safeTitle}.pdf"`);
    if (fileInfo.contentLength) {
      res.setHeader("Content-Length", fileInfo.contentLength);
    }

    pipeline(fileInfo.stream, res, (err) => {
      if (err) {
        if (!res.headersSent) {
          next(err);
        } else {
          res.destroy(err);
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieves student learning progress for a specific material.
 */
export async function getMaterialProgress(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const materialId = getParam(req.params.id);
    const targetStudentId = (req.query.studentId as string) || req.user.userId;

    const progress = await getStudentMaterialProgress(
      materialId,
      targetStudentId,
      req.user.userId,
      req.user.role
    );

    res.status(200).json({
      success: true,
      data: progress,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Persists or updates student learning progress for a specific material.
 */
export async function saveMaterialProgress(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const materialId = getParam(req.params.id);
    const targetStudentId = req.body.studentId || req.user.userId;

    const progress = await updateStudentMaterialProgress(
      materialId,
      targetStudentId,
      {
        currentPage: req.body.currentPage,
        totalPages: req.body.totalPages,
        completed: req.body.completed,
      },
      req.user.userId,
      req.user.role
    );

    res.status(200).json({
      success: true,
      message: "Material learning progress saved successfully",
      data: progress,
    });
  } catch (error) {
    next(error);
  }
}

export async function addMaterial(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const courseId = getParam(req.params.courseId);
    const file = req.file;

    const title = req.body?.title || (file ? file.originalname.replace(/\.[^/.]+$/, "") : undefined);
    const unit = req.body?.unit || "Unit 1";
    const fileType = file ? "pdf" : req.body?.fileType || "pdf";
    const fileSize = file
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : req.body?.fileSize || "2.5 MB";

    const materialInput = {
      title,
      unit,
      fileType,
      fileSize,
      fileUrl: req.body?.fileUrl,
    };

    const fileBuffer = file?.buffer;
    const originalFilename = file?.originalname;

    const material = await createMaterial(
      courseId,
      materialInput,
      req.user.userId,
      req.user.role,
      fileBuffer,
      originalFilename
    );

    res.status(201).json({
      success: true,
      message: "Material uploaded and ingested successfully",
      data: material,
    });
  } catch (error) {
    next(error);
  }
}

export async function modifyMaterial(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const id = getParam(req.params.id);
    const updated = await updateMaterial(id, req.body || {}, req.user.userId, req.user.role);

    res.status(200).json({
      success: true,
      message: "Material updated successfully",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

export async function removeMaterial(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const id = getParam(req.params.id);
    const result = await deleteMaterial(id, req.user.userId, req.user.role);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
}

export async function listMaterialChunks(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }

    const id = getParam(req.params.id);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

    const chunkData = await getMaterialChunks(id, page, limit);

    res.status(200).json({
      success: true,
      data: chunkData,
    });
  } catch (error) {
    next(error);
  }
}

