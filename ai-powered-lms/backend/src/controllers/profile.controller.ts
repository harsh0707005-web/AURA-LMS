import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/auth.types.js";
import { getUserProfile, updateUserProfile } from "../services/auth.service.js";

export async function getProfile(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const profile = await getUserProfile(req.user.userId);

    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const updatedProfile = await updateUserProfile(req.user.userId, req.body);

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: updatedProfile,
    });
  } catch (error) {
    next(error);
  }
}
