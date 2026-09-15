import { Router } from "express";
import {
  listFaculty,
  getFaculty,
  listFacultyCourses,
} from "../controllers/academic.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

router.get("/", authenticate, listFaculty);
router.get("/:id", authenticate, getFaculty);
router.get("/:id/courses", authenticate, listFacultyCourses);

export default router;
