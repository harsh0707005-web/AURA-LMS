import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthRequest, AuthPayload } from "../types/auth.types.js";
import prisma from "../lib/prisma.js";

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim() === "") {
    throw new Error(
      "CRITICAL CONFIGURATION ERROR: JWT_SECRET is not configured in environment variables. Server cannot authenticate requests."
    );
  }
  return secret;
}

export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
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

    let decoded: AuthPayload;
    try {
      decoded = jwt.verify(token, secret) as AuthPayload;
      if (!decoded || typeof decoded.userId !== "string") throw new Error("Invalid payload");
    } catch {
      res.status(401).json({ success: false, message: "Unauthorized: Invalid or expired access token" });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: decoded.userId }, select: { id: true, email: true, role: true, status: true } });
    if (!user || user.status !== "ACTIVE") {
      res.status(401).json({ success: false, message: "Unauthorized: Account is not active" });
      return;
    }
    req.user = { userId: user.id, email: user.email, role: user.role };
    next();
  } catch (error: unknown) {
    next(error);
  }
}
