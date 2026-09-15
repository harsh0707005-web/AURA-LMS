import { Router } from "express";
import {
  studentAnalytics,
  courseAnalytics,
  facultyAnalytics,
  atRiskAnalytics,
} from "../controllers/analytics.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles, authorizeStudentAccess } from "../middleware/role.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/student/:id", authorizeStudentAccess("id"), studentAnalytics);
router.get("/course/:id", authorizeRoles("FACULTY", "ADMIN"), courseAnalytics);
router.get("/faculty/:id", authorizeRoles("FACULTY", "ADMIN"), facultyAnalytics);
router.get("/at-risk", authorizeRoles("FACULTY", "ADMIN"), atRiskAnalytics);

export default router;

