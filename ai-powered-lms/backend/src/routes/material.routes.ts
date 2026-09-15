import { Router } from "express";
import {
  getMaterial,
  modifyMaterial,
  removeMaterial,
  listMaterialChunks,
  streamMaterialFile,
  getMaterialProgress,
  saveMaterialProgress,
} from "../controllers/material.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";

const router = Router();

// Single material details and vector chunks
router.get("/:id", authenticate, getMaterial);
router.get("/:id/chunks", authenticate, listMaterialChunks);

// Protected PDF file streaming (verifies course enrollment for students)
router.get("/:id/file", authenticate, streamMaterialFile);

// Student learning progress tracking
router.get("/:id/progress", authenticate, getMaterialProgress);
router.put("/:id/progress", authenticate, saveMaterialProgress);

// Faculty & Admin material management
router.put("/:id", authenticate, authorizeRoles("FACULTY", "ADMIN"), modifyMaterial);
router.delete("/:id", authenticate, authorizeRoles("FACULTY", "ADMIN"), removeMaterial);

export default router;

