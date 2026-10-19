import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/auth.types.js";
import { getParam } from "../lib/param.js";
import { importStudentRegistry, listFacultyApplications, reviewFacultyApplication } from "../services/institution.service.js";

export async function listApplications(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json({ success: true, data: await listFacultyApplications(req.user!.userId) }); } catch (error) { next(error); }
}
export function reviewApplication(decision: "APPROVED" | "REJECTED") {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try { res.json({ success: true, data: await reviewFacultyApplication(req.user!.userId, getParam(req.params.id), decision, req.body) }); } catch (error) { next(error); }
  };
}
export async function importRegistry(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json({ success: true, data: await importStudentRegistry(req.user!.userId, req.body) }); } catch (error) { next(error); }
}
