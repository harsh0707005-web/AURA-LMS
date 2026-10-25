import { Router } from "express";
import {
  createNewAnnouncement,
  listAnnouncements,
  listNotifications,
  readAllNotifications,
  readNotification,
} from "../controllers/announcement.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";

const announcementRoutes = Router();

announcementRoutes.get("/", authenticate, listAnnouncements);
announcementRoutes.post("/", authenticate, authorizeRoles("FACULTY", "ADMIN"), createNewAnnouncement);

export const notificationRoutes = Router();
notificationRoutes.get("/", authenticate, listNotifications);
notificationRoutes.patch("/read-all", authenticate, readAllNotifications);
notificationRoutes.patch("/:id/read", authenticate, readNotification);

export default announcementRoutes;
