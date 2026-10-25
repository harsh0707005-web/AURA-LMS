import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import prisma from "../lib/prisma.js";
import { requestPasswordReset, resetPassword } from "../services/password-reset.service.js";

function replace(t: any, target: any, method: string, implementation: (...args: any[]) => any) {
  const original = target[method];
  target[method] = implementation;
  t.after(() => { target[method] = original; });
}

function transactionMock(t: any, tx: any) {
  replace(t, prisma as any, "$transaction", async (work: (transaction: any) => Promise<unknown>) => work(tx));
}

test("password reset requests are generic and rotate prior tokens", { concurrency: false }, async (t) => {
  process.env.RESEND_API_KEY = "";
  const created: any[] = [];
  let lookup: any = { id: "user-1", email: "student@example.edu", status: "ACTIVE" };
  replace(t, prisma.user, "findUnique", async () => lookup);
  transactionMock(t, {
    passwordResetToken: {
      updateMany: async () => ({ count: 1 }),
      create: async ({ data }: any) => { created.push(data); return data; },
    },
  });

  const first = await requestPasswordReset({ email: "Student@Example.edu" });
  assert.equal(first.message, "If an active account exists for that email, a password reset link has been sent.");
  assert.equal(created.length, 1);
  assert.equal(created[0].tokenHash.length, 64);

  lookup = null;
  const second = await requestPasswordReset({ email: "unknown@example.edu" });
  assert.equal(second.message, first.message);
  assert.equal(created.length, 1);
});

test("password reset consumes a token once and updates the bcrypt hash transactionally", { concurrency: false }, async (t) => {
  const rawToken = "a".repeat(64);
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  let consumed = false;
  let updatedPasswordHash = "";
  let revokedSessions = false;
  const tx: any = {
    passwordResetToken: {
      findUnique: async () => consumed
        ? { id: "reset-1", tokenHash, expiresAt: new Date(Date.now() + 60_000), usedAt: new Date(), user: { id: "user-1", status: "ACTIVE" } }
        : { id: "reset-1", tokenHash, expiresAt: new Date(Date.now() + 60_000), usedAt: null, user: { id: "user-1", status: "ACTIVE" } },
      updateMany: async ({ data }: any) => {
        if (data.usedAt && !consumed) {
          consumed = true;
          return { count: 1 };
        }
        return { count: 1 };
      },
    },
    user: {
      update: async ({ data }: any) => { updatedPasswordHash = data.passwordHash; return data; },
    },
    refreshSession: {
      updateMany: async () => { revokedSessions = true; return { count: 1 }; },
    },
  };
  transactionMock(t, tx);

  const result = await resetPassword(rawToken, "NewPassword123");
  assert.equal(result.message, "Password updated. You can now sign in with your new password.");
  assert.ok(updatedPasswordHash);
  assert.equal(revokedSessions, true);
  assert.notEqual(updatedPasswordHash, "NewPassword123");
  await assert.rejects(resetPassword(rawToken, "AnotherPassword123"), { statusCode: 400 });
});

test("password reset rejects weak passwords before touching the database", async () => {
  await assert.rejects(resetPassword("a".repeat(64), "short"), { statusCode: 400 });
});
