import assert from "node:assert/strict";
import test from "node:test";
import prisma from "../lib/prisma.js";
import { hashRefreshToken, refreshCookieOptions, rotateRefreshSession } from "../services/refresh-session.service.js";

function replace(t: any, target: any, method: string, implementation: (...args: any[]) => any) {
  const original = target[method];
  target[method] = implementation;
  t.after(() => { target[method] = original; });
}

test("refresh cookie is constrained to the auth API and is HttpOnly/SameSite", () => {
  assert.equal(refreshCookieOptions.httpOnly, true);
  assert.equal(refreshCookieOptions.sameSite, "lax");
  assert.equal(refreshCookieOptions.path, "/api/auth");
});

test("refresh sessions are hashed and rotate exactly once", { concurrency: false }, async (t) => {
  const rawToken = "current-refresh-token";
  const created: any[] = [];
  let current: any = {
    id: "session-1",
    tokenHash: hashRefreshToken(rawToken),
    userId: "user-1",
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    user: {
      id: "user-1",
      name: "Student",
      email: "student@example.edu",
      role: "STUDENT",
      status: "ACTIVE",
      department: null,
      enrollmentNo: null,
      employeeId: null,
      avatarUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      passwordHash: "ignored",
    },
  };
  const tx: any = {
    refreshSession: {
      findUnique: async ({ where }: any) => where.tokenHash === current.tokenHash ? current : null,
      updateMany: async ({ data }: any) => {
        current = { ...current, ...data };
        return { count: 1 };
      },
      create: async ({ data }: any) => { created.push(data); return data; },
    },
  };
  replace(t, prisma as any, "$transaction", async (work: (transaction: any) => Promise<unknown>) => work(tx));

  const rotated = await rotateRefreshSession(rawToken);
  assert.notEqual(rotated.rawToken, rawToken);
  assert.equal(created.length, 1);
  assert.equal(created[0].tokenHash, hashRefreshToken(rotated.rawToken));
  assert.notEqual(created[0].tokenHash, rawToken);
  assert.ok(current.revokedAt);
});

test("reusing a rotated refresh token revokes the remaining account sessions", { concurrency: false }, async (t) => {
  const rawToken = "replayed-refresh-token";
  let revokeAllCount = 0;
  const tx: any = {
    refreshSession: {
      findUnique: async () => ({ id: "session-1", userId: "user-1", tokenHash: hashRefreshToken(rawToken), revokedAt: new Date(), user: { status: "ACTIVE" } }),
      updateMany: async ({ where }: any) => {
        if (where.userId) revokeAllCount += 1;
        return { count: 1 };
      },
    },
  };
  replace(t, prisma as any, "$transaction", async (work: (transaction: any) => Promise<unknown>) => work(tx));

  await assert.rejects(rotateRefreshSession(rawToken), { statusCode: 401, message: "Refresh session reuse detected" });
  assert.equal(revokeAllCount, 1);
});
