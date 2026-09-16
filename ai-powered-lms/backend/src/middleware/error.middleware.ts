import { Request, Response, NextFunction } from "express";

export interface AppError extends Error {
  statusCode?: number;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if ((err as any).code === "LIMIT_FILE_SIZE") {
    res.status(413).json({
      success: false,
      message: "File exceeds maximum permitted size of 25 MB",
    });
    return;
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal server error occurred";

  // Centralized response format without exposing internal stack traces in client response
  res.status(statusCode).json({
    success: false,
    message,
  });
}
