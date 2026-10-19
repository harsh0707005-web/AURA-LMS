import bcrypt from "bcrypt";
import { createHash, randomBytes } from "node:crypto";
import prisma from "../lib/prisma.js";
import { Prisma } from "../generated/prisma/client.js";
import { sendVerificationEmail } from "./verification-email.service.js";

export const registrationError = (message: string, statusCode = 400) => Object.assign(new Error(message), { statusCode });
export function objectInput(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw registrationError("A JSON object is required");
  return input as Record<string, unknown>;
}
export function text(input: unknown, label: string, max = 200): string {
  if (typeof input !== "string" || !input.trim() || input.trim().length > max) throw registrationError(`${label} is required and must be a valid string`);
  return input.trim();
}
export function normalizeEmail(input: unknown): string {
  const email = text(input, "Email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw registrationError("A valid email address is required");
  return email;
}
export function normalizeIdentifier(input: unknown, label: string): string {
  const value = text(input, label, 80).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._/-]*$/.test(value)) throw registrationError(`${label} contains invalid characters`);
  return value;
}
export async function registrationTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  try {
    return await prisma.$transaction(work, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && ["P2002", "P2034"].includes(String(error.code))) {
      throw registrationError("Registration data conflicts with another request. Please refresh and try again.", 409);
    }
    throw error;
  }
}
function newVerificationToken() {
  const raw = randomBytes(32).toString("hex");
  return { raw, tokenHash: createHash("sha256").update(raw).digest("hex"), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) };
}

export async function registerUser(input: unknown) {
  const body = objectInput(input);
  // Account type expresses an application intent, never an authorization role.
  if (body.role === "ADMIN") throw registrationError("Public registration for Administrator role is prohibited");
  // Legacy role is accepted only as an application-type hint; it never becomes the stored authorization role.
  const accountType = body.accountType ?? (body.role === "FACULTY" ? "FACULTY" : "STUDENT");
  if (accountType !== "STUDENT" && accountType !== "FACULTY") throw registrationError("Choose a student or faculty application");
  const name = text(body.name, "Full name");
  const email = normalizeEmail(body.email);
  if (typeof body.password !== "string" || body.password.length < 8 || Buffer.byteLength(body.password) > 72) throw registrationError("Password must contain at least 8 characters and at most 72 bytes");
  const department = body.department === undefined ? "Computer Engineering" : text(body.department, "Department");
  const identifier = normalizeIdentifier(accountType === "STUDENT" ? body.enrollmentNo : body.employeeId, accountType === "STUDENT" ? "Enrollment number" : "Employee ID");
  const passwordHash = await bcrypt.hash(body.password, 10);
  const token = newVerificationToken();
  await registrationTransaction(async tx => {
    if (await tx.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } })) throw registrationError("An account with this email already exists", 409);
    if (accountType === "FACULTY") {
      if (await tx.user.findFirst({ where: { employeeId: { equals: identifier, mode: "insensitive" } } })) throw registrationError("Employee ID is already registered", 409);
      const user = await tx.user.create({ data: { name, email, passwordHash, department, role: "STUDENT", status: "PENDING_FACULTY_APPROVAL" } });
      await tx.facultyApplication.create({ data: { applicantId: user.id, employeeId: identifier, email } });
      return;
    }
    const registry = await tx.studentRegistry.findUnique({ where: { enrollmentNo: identifier }, include: { applicant: { select: { id: true } } } });
    if (!registry || registry.email !== email || !registry.active || registry.claimed || registry.claimedAt || registry.applicant) throw registrationError("Enrollment number and email must match an active, unclaimed institutional student record", 403);
    const user = await tx.user.create({ data: { name, email, passwordHash, department, enrollmentNo: identifier, studentRegistryId: registry.id, role: "STUDENT", status: "PENDING_EMAIL" } });
    await tx.emailVerificationToken.create({ data: { userId: user.id, tokenHash: token.tokenHash, expiresAt: token.expiresAt } });
  });
  if (accountType === "FACULTY") return { status: "PENDING_FACULTY_APPROVAL" as const, message: "Application received. An administrator must approve your faculty account before you can sign in." };
  const verificationDelivery = await sendVerificationEmail(email, token.raw);
  return { status: "PENDING_EMAIL" as const, verificationDelivery, message: verificationDelivery === "SENT" ? "Registration received. Verify your email before signing in." : "Registration received. Email verification is pending; delivery is unavailable. Contact your institution." };
}

export async function verifyStudentEmail(rawToken: unknown) {
  if (typeof rawToken !== "string" || !/^[a-f0-9]{64}$/.test(rawToken)) throw registrationError("Invalid or expired verification token");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const now = new Date();
  await registrationTransaction(async tx => {
    const token = await tx.emailVerificationToken.findUnique({ where: { tokenHash }, include: { user: { include: { studentRegistry: true } } } });
    if (!token || token.usedAt || token.expiresAt <= now) throw registrationError("Invalid or expired verification token");
    const user = token.user;
    const registry = user.studentRegistry;
    if (user.status !== "PENDING_EMAIL" || user.role !== "STUDENT" || !registry || !registry.active || registry.claimed || registry.claimedAt || registry.email !== user.email || registry.enrollmentNo !== user.enrollmentNo) throw registrationError("This account is not eligible for email activation", 409);
    const consumed = await tx.emailVerificationToken.updateMany({ where: { id: token.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
    if (consumed.count !== 1) throw registrationError("Invalid or expired verification token");
    const claimed = await tx.studentRegistry.updateMany({ where: { id: registry.id, active: true, claimed: false, claimedAt: null, email: user.email, enrollmentNo: user.enrollmentNo! }, data: { claimed: true, claimedAt: now } });
    if (claimed.count !== 1) throw registrationError("Student record is no longer available", 409);
    const activated = await tx.user.updateMany({ where: { id: user.id, status: "PENDING_EMAIL", role: "STUDENT" }, data: { status: "ACTIVE" } });
    if (activated.count !== 1) throw registrationError("Account is no longer pending verification", 409);
    await tx.emailVerificationToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } });
  });
  return { status: "ACTIVE" as const, message: "Email verified. You can now sign in." };
}

export async function resendVerification(input: unknown) {
  const email = normalizeEmail(objectInput(input).email);
  const token = newVerificationToken();
  const shouldSend = await registrationTransaction(async tx => {
    const user = await tx.user.findUnique({ where: { email }, include: { studentRegistry: true } });
    if (!user || user.status !== "PENDING_EMAIL" || !user.studentRegistry?.active || user.studentRegistry.claimed || user.studentRegistry.claimedAt || user.studentRegistry.email !== email) return false;
    // Keep an earlier unexpired token valid if delivery of this new message fails.
    await tx.emailVerificationToken.create({ data: { userId: user.id, tokenHash: token.tokenHash, expiresAt: token.expiresAt } });
    return true;
  });
  if (shouldSend) await sendVerificationEmail(email, token.raw);
  // Identical response for absent, active and pending accounts.
  return { message: "If an eligible account exists, verification remains pending until the emailed link is used. If no email arrives, contact your institution." };
}
