import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { importRegistry, listApplications, reviewApplication } from "../controllers/institution.controller.js";

const router = Router();
router.use(authenticate, authorizeRoles("ADMIN"));
router.get("/faculty-applications", listApplications);
router.post("/faculty-applications/:id/approve", reviewApplication("APPROVED"));
router.post("/faculty-applications/:id/reject", reviewApplication("REJECTED"));
router.post("/student-registry/import", importRegistry);
export default router;
