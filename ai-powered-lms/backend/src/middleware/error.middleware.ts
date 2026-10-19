import { Request, Response, NextFunction } from "express";

export interface AppError extends Error {
  statusCode?: number;
  status?: number;
  code?: string;
  details?: unknown;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (res.headersSent) {
    _next(err);
    return;
  }
  if ((err as any).code === "LIMIT_FILE_SIZE") {
    res.status(413).json({
      success: false,
      message: "File exceeds maximum permitted size of 25 MB",
    });
    return;
  }

  if (err.code === "EMBEDDING_DIMENSION_MISMATCH") {
    res.status(502).json({ success: false, message: "Embedding vector has an invalid dimension", code: err.code, details: err.details });
    return;
  }

  const requestedStatus = err.statusCode ?? err.status;
  const statusCode = requestedStatus && requestedStatus >= 400 && requestedStatus < 500
    ? requestedStatus
    : 500;
  const message = statusCode === 500 && process.env.NODE_ENV === "production"
    ? "Internal server error"
    : err.message || "Internal server error occurred";

  if (statusCode === 500) {
    console.error("Unhandled request error:", err);
  }

  // Centralized response format without exposing internal stack traces in client response
  res.status(statusCode).json({
    success: false,
    message,
  });
}
