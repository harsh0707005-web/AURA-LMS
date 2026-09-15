import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "../types/auth.types.js";
import {
  registerUser,
  loginUser,
  getUserProfile,
} from "../services/auth.service.js";

export async function register(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const newUser = await registerUser(req.body);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: newUser,
    });
  } catch (error) {
    next(error);
  }
}

export async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await loginUser(req.body);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMe(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: User not found in session",
      });
      return;
    }

    const userProfile = await getUserProfile(req.user.userId);

    res.status(200).json({
      success: true,
      message: "Authenticated user profile retrieved",
      data: userProfile,
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(_req: Request, res: Response): Promise<void> {
  res.status(200).json({
    success: true,
    message: "Logout successful",
  });
}
