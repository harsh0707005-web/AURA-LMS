import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "../types/auth.types.js";
import {
  registerUser,
  loginUser,
  getUserProfile,
  issueAccessToken,
  sanitizeUser,
  verifyStudentEmail,
  resendVerification,
} from "../services/auth.service.js";
import { requestPasswordReset, resetPassword } from "../services/password-reset.service.js";
import {
  readRefreshToken,
  refreshCookieOptions,
  REFRESH_COOKIE_NAME,
  revokeRefreshSession,
  rotateRefreshSession,
} from "../services/refresh-session.service.js";

export async function register(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const newUser = await registerUser(req.body);

    res.status(201).json({
      success: true,
      message: newUser.message,
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
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: { token: result.token, user: result.user },
    });
  } catch (error) {
    next(error);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const currentToken = readRefreshToken(req.headers.cookie);
    const rotated = await rotateRefreshSession(currentToken || "");
    res.cookie(REFRESH_COOKIE_NAME, rotated.rawToken, refreshCookieOptions);
    res.status(200).json({
      success: true,
      message: "Access token refreshed",
      data: { token: issueAccessToken(rotated.user), user: sanitizeUser(rotated.user) },
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

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await revokeRefreshSession(readRefreshToken(req.headers.cookie));
    res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions);
    res.status(200).json({ success: true, message: "Logout successful" });
  } catch (error) {
    next(error);
  }
}

export async function verifyEmail(req: Request, res: Response, next: NextFunction) {
  try { const result = await verifyStudentEmail(req.body?.token); res.json({ success: true, message: result.message, data: result }); } catch (error) { next(error); }
}

export async function resendEmail(req: Request, res: Response, next: NextFunction) {
  try { const result = await resendVerification(req.body); res.status(202).json({ success: true, message: result.message, data: result }); } catch (error) { next(error); }
}

export async function requestReset(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await requestPasswordReset(req.body);
    res.status(202).json({ success: true, message: result.message, data: result });
  } catch (error) {
    next(error);
  }
}

export async function reset(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await resetPassword(req.body?.token, req.body?.password);
    res.status(200).json({ success: true, message: result.message, data: result });
  } catch (error) {
    next(error);
  }
}
