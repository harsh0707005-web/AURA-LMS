import { Router } from "express";
import {
  listUsers,
  getUser,
  modifyUser,
  removeUser,
} from "../controllers/user.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";

const router = Router();

// Restricted strictly to ADMIN
router.use(authenticate);
router.use(authorizeRoles("ADMIN"));

router.get("/", listUsers);
router.get("/:id", getUser);
router.put("/:id", modifyUser);
router.delete("/:id", removeUser);

export default router;
