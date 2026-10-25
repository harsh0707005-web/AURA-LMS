import bcrypt from "bcrypt";
import { createHash, randomBytes } from "node:crypto";
import prisma from "../lib/prisma.js";
import { normalizeEmail, objectInput, registrationError } from "./registration.service.js";
import { sendPasswordResetEmail } from "./password-reset-email.service.js";
import { revokeAllRefreshSessions } from "./refresh-session.service.js";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

function newResetToken() {
  const raw = randomBytes(32).toString("hex");
  return {
    raw,
    tokenHash: createHash("sha256").update(raw).digest("hex"),
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
  };
}

export function assertValidPassword(password: unknown): asserts password is string {
  if (typeof password !== "string" || password.length < 8 || Buffer.byteLength(password) > 72) {
    throw registrationError("Password must contain at least 8 characters and at most 72 bytes");
  }
}

/** Always returns the same response so callers cannot discover whether an email is registered. */
export async function requestPasswordReset(input: unknown) {
  const email = normalizeEmail(objectInput(input).email);
  const token = newResetToken();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, status: true },
  });

  if (user?.status === "ACTIVE") {
    await prisma.$transaction(async tx => {
      await tx.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      await tx.passwordResetToken.create({
        data: { userId: user.id, tokenHash: token.tokenHash, expiresAt: token.expiresAt },
      });
    });
    await sendPasswordResetEmail(user.email, token.raw);
  }

  return {
    message: "If an active account exists for that email, a password reset link has been sent.",
  };
}

export async function resetPassword(rawToken: unknown, password: unknown) {
  if (typeof rawToken !== "string" || !/^[a-f0-9]{64}$/.test(rawToken)) {
    throw registrationError("Invalid or expired password reset link");
  }
  assertValidPassword(password);

  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const now = new Date();
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.$transaction(async tx => {
    const token = await tx.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, status: true } } },
    });
    if (!token || token.usedAt || token.expiresAt <= now || token.user.status !== "ACTIVE") {
      throw registrationError("Invalid or expired password reset link");
    }

    const consumed = await tx.passwordResetToken.updateMany({
      where: { id: token.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (consumed.count !== 1) throw registrationError("Invalid or expired password reset link");

    await tx.user.update({ where: { id: token.user.id }, data: { passwordHash } });
    await revokeAllRefreshSessions(token.user.id, tx);
    await tx.passwordResetToken.updateMany({
      where: { userId: token.user.id, usedAt: null },
      data: { usedAt: now },
    });
  });

  return { message: "Password updated. You can now sign in with your new password." };
}
