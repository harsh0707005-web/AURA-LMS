import { createHash, randomBytes } from "node:crypto";
import { CookieOptions } from "express";
import prisma from "../lib/prisma.js";

export const REFRESH_COOKIE_NAME = "aura_refresh_token";
export const REFRESH_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "true",
  sameSite: "lax",
  path: "/api/auth",
  maxAge: REFRESH_SESSION_TTL_MS,
};

function sessionError(message = "Invalid or expired refresh session") {
  return Object.assign(new Error(message), { statusCode: 401 });
}

export function hashRefreshToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

function newRefreshToken() {
  const rawToken = randomBytes(32).toString("base64url");
  return { rawToken, tokenHash: hashRefreshToken(rawToken) };
}

export async function createRefreshSession(userId: string): Promise<string> {
  const token = newRefreshToken();
  await prisma.refreshSession.create({
    data: {
      userId,
      tokenHash: token.tokenHash,
      expiresAt: new Date(Date.now() + REFRESH_SESSION_TTL_MS),
    },
  });
  return token.rawToken;
}

export async function rotateRefreshSession(rawToken: string) {
  if (!rawToken) throw sessionError();

  const token = newRefreshToken();
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const current = await tx.refreshSession.findUnique({
      where: { tokenHash: hashRefreshToken(rawToken) },
      include: { user: true },
    });

    if (!current) throw sessionError();
    if (current.revokedAt) {
      await tx.refreshSession.updateMany({
        where: { userId: current.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      throw sessionError("Refresh session reuse detected");
    }
    if (current.expiresAt <= now || current.user.status !== "ACTIVE") throw sessionError();

    const consumed = await tx.refreshSession.updateMany({
      where: { id: current.id, revokedAt: null },
      data: { revokedAt: now, lastUsedAt: now },
    });
    if (consumed.count !== 1) {
      await tx.refreshSession.updateMany({
        where: { userId: current.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      throw sessionError("Refresh session reuse detected");
    }

    await tx.refreshSession.create({
      data: {
        userId: current.userId,
        tokenHash: token.tokenHash,
        expiresAt: new Date(Date.now() + REFRESH_SESSION_TTL_MS),
      },
    });

    return { rawToken: token.rawToken, user: current.user };
  });
}

export async function revokeRefreshSession(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  await prisma.refreshSession.updateMany({
    where: { tokenHash: hashRefreshToken(rawToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllRefreshSessions(userId: string, client: any = prisma): Promise<void> {
  await client.refreshSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function readRefreshToken(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  const pair = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${REFRESH_COOKIE_NAME}=`));
  if (!pair) return undefined;
  try {
    return decodeURIComponent(pair.slice(REFRESH_COOKIE_NAME.length + 1));
  } catch {
    return undefined;
  }
}
