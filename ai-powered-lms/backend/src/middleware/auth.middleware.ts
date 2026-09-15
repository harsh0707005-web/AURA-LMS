import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthRequest, AuthPayload } from "../types/auth.types.js";

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim() === "") {
    throw new Error(
      "CRITICAL CONFIGURATION ERROR: JWT_SECRET is not configured in environment variables. Server cannot authenticate requests."
    );
  }
  return secret;
}

export function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers["authorization"];

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: Access token missing or malformed",
      });
      return;
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: Access token is empty",
      });
      return;
    }

    const secret = getJwtSecret();

    jwt.verify(token, secret, (err, decoded) => {
      if (err || !decoded) {
        res.status(401).json({
          success: false,
          message: "Unauthorized: Invalid or expired access token",
        });
        return;
      }

      req.user = decoded as AuthPayload;
      next();
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Authentication verification failed";
    res.status(500).json({
      success: false,
      message,
    });
  }
}
