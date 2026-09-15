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
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal server error occurred";

  // Centralized response format without exposing internal stack traces in client response
  res.status(statusCode).json({
    success: false,
    message,
  });
}
