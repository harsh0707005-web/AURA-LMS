import "dotenv/config";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { parseDatabaseUrl, restoreTarget } from "../lib/backup.js";

let stage = "target-validation";
async function run(): Promise<void> {
  if (process.env.CONFIRM_LOCAL_DRILL !== "YES") throw new Error("Explicit local drill confirmation required.");
  const target = restoreTarget(parseDatabaseUrl(process.env.DATABASE_URL), process.env.RESTORE_DATABASE_NAME);
  // All database-dependent modules are imported AFTER selecting the isolated target.
  process.env.DATABASE_URL = target.toString();
  stage = "module-load";
  const { default: prisma } = await import("../lib/prisma.js");
  const { default: bcrypt } = await import("bcrypt");
  const { loginUser } = await import("../services/auth.service.js");
  const { rotateRefreshSession, revokeRefreshSession } = await import("../services/refresh-session.service.js");
  const { resetPassword } = await import("../services/password-reset.service.js");
  const { verifyStudentEmail } = await import("../services/registration.service.js");
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  try {
    stage = "synthetic-account";
    const password = randomBytes(24).toString("hex");
    const email = `restore-${randomUUID()}@example.invalid`;
    const registry = await prisma.studentRegistry.create({ data: { enrollmentNo: `DRILL-${randomUUID()}`.toUpperCase(), email } });
    const user = await prisma.user.create({ data: {
      name: "Synthetic Restore Check", email, passwordHash: await bcrypt.hash(password, 10),
      role: "STUDENT", status: "PENDING_EMAIL", studentRegistryId: registry.id, enrollmentNo: registry.enrollmentNo,
    } });
    const rawVerification = randomBytes(32).toString("hex");
    await prisma.emailVerificationToken.create({ data: { userId: user.id, tokenHash: hash(rawVerification), expiresAt: new Date(Date.now() + 60_000) } });
    stage = "pending-login";
    await assert.rejects(loginUser({ email, password }), { statusCode: 403 });
    stage = "verification";
    await verifyStudentEmail(rawVerification);
    await assert.rejects(verifyStudentEmail(rawVerification), { statusCode: 400 });
    stage = "active-login";
    const session = await loginUser({ email, password });
    assert.equal(session.user.status, "ACTIVE");
    stage = "refresh-and-logout";
    const rotated = await rotateRefreshSession(session.refreshToken);
    await revokeRefreshSession(rotated.rawToken);
    await assert.rejects(rotateRefreshSession(rotated.rawToken), { statusCode: 401 });
    stage = "password-reset";
    const resetSession = await loginUser({ email, password });
    const rawReset = randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: hash(rawReset), expiresAt: new Date(Date.now() + 60_000) } });
    const newPassword = randomBytes(24).toString("hex");
    await resetPassword(rawReset, newPassword);
    await assert.rejects(resetPassword(rawReset, newPassword), { statusCode: 400 });
    await assert.rejects(loginUser({ email, password }), { statusCode: 401 });
    await assert.rejects(rotateRefreshSession(resetSession.refreshToken), { statusCode: 401 });
    const finalSession = await loginUser({ email, password: newPassword });
    await revokeRefreshSession(finalSession.refreshToken);
    console.log("Restored-database auth PASS: pending-account rejection, single-use verification, login, refresh rotation, logout revocation, password reset, old-password rejection and reset-session revocation.");
    console.log("Synthetic account retained only in the isolated test database. No email sent; browser cookie behavior not tested.");
  } finally { await prisma.$disconnect(); }
}

run().catch((error: unknown) => {
  const code = error && typeof error === "object" && "code" in error && /^(P\d{4}|ERR_ASSERTION|ERR_MODULE_NOT_FOUND)$/.test(String(error.code)) ? String(error.code) : "WITHHELD";
  console.error(`[RESTORED_AUTH_FAILED] stage=${stage} code=${code}. Raw diagnostics withheld; source database was not selected.`);
  process.exitCode = 1;
});
