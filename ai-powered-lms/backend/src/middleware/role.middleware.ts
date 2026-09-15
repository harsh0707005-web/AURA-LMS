import { Response, NextFunction } from "express";
import { AuthRequest, Role } from "../types/auth.types.js";
import { getParam } from "../lib/param.js";

export function authorizeRoles(...allowedRoles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !req.user.role) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: User session is missing or unauthenticated",
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Forbidden: Access restricted to [${allowedRoles.join(", ")}] roles. Current role: ${req.user.role}`,
      });
      return;
    }

    next();
  };
}

/**
 * Enforces ownership and access boundaries for student-specific resources.
 * - STUDENT: May access ONLY their own record (req.user.userId === targetStudentId).
 * - FACULTY: Retains authorized departmental monitoring permissions.
 * - ADMIN: Retains institutional oversight permissions.
 * - Unauthenticated / mismatched roles: Denied with appropriate 401 / 403 status.
 */
export function authorizeStudentAccess(paramName: string = "id") {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !req.user.userId || !req.user.role) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: User session is missing or unauthenticated",
      });
      return;
    }

    const targetStudentId = getParam(req.params[paramName]);
    if (!targetStudentId) {
      res.status(400).json({
        success: false,
        message: "Invalid request: Student identifier is missing in parameters",
      });
      return;
    }

    // Administrators and Faculty retain authorized academic monitoring permissions
    if (req.user.role === "ADMIN" || req.user.role === "FACULTY") {
      next();
      return;
    }

    // Students are strictly isolated to their own user ID
    if (req.user.role === "STUDENT") {
      if (req.user.userId !== targetStudentId) {
        res.status(403).json({
          success: false,
          message: "Forbidden: Access denied to requested student resource",
        });
        return;
      }

      next();
      return;
    }

    // Default safe denial
    res.status(403).json({
      success: false,
      message: "Forbidden: Access restricted",
    });
  };
}

