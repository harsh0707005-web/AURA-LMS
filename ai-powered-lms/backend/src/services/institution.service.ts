import prisma from "../lib/prisma.js";
import { Prisma } from "../generated/prisma/client.js";
import { normalizeEmail, normalizeIdentifier, objectInput, registrationError, registrationTransaction, text } from "./registration.service.js";

async function requireAdmin(tx: Prisma.TransactionClient, actorId: string) {
  const actor = await tx.user.findUnique({ where: { id: actorId }, select: { role: true, status: true } });
  if (!actor || actor.role !== "ADMIN" || actor.status !== "ACTIVE") throw registrationError("An active administrator is required", 403);
}

const applicationSelect = {
  id: true, employeeId: true, email: true, applicantId: true, status: true,
  reviewerId: true, reviewedAt: true, note: true, createdAt: true, updatedAt: true,
  applicant: { select: { id: true, name: true, email: true, department: true, status: true } },
} satisfies Prisma.FacultyApplicationSelect;

export async function listFacultyApplications(actorId: string) {
  return registrationTransaction(async tx => {
    await requireAdmin(tx, actorId);
    return tx.facultyApplication.findMany({ select: applicationSelect, orderBy: { createdAt: "desc" } });
  });
}

export async function reviewFacultyApplication(actorId: string, applicationId: string, decision: "APPROVED" | "REJECTED", input: unknown) {
  const body = objectInput(input ?? {});
  if (Object.keys(body).some(key => key !== "note")) throw registrationError("Only a review note may be submitted");
  const note = body.note === undefined || body.note === "" ? null : text(body.note, "Review note", 2000);
  return registrationTransaction(async tx => {
    await requireAdmin(tx, actorId);
    const application = await tx.facultyApplication.findUnique({ where: { id: applicationId }, include: { applicant: true } });
    if (!application) throw registrationError("Faculty application not found", 404);
    if (application.status !== "PENDING" || application.applicant.status !== "PENDING_FACULTY_APPROVAL" || application.applicant.role !== "STUDENT") throw registrationError("Application is no longer pending", 409);
    if (application.applicant.email !== application.email || application.applicant.studentRegistryId) throw registrationError("Applicant identity does not match the application", 409);
    if (decision === "APPROVED") {
      const duplicate = await tx.user.findFirst({ where: { id: { not: application.applicantId }, OR: [{ email: { equals: application.email, mode: "insensitive" } }, { employeeId: { equals: application.employeeId, mode: "insensitive" } }] } });
      if (duplicate) throw registrationError("Employee ID or email is already assigned to another user", 409);
      const duplicateApplication = await tx.facultyApplication.findFirst({ where: { id: { not: application.id }, OR: [{ employeeId: application.employeeId }, { email: application.email }] } });
      if (duplicateApplication) throw registrationError("Employee ID or email belongs to another application", 409);
    }
    const now = new Date();
    const reviewed = await tx.facultyApplication.updateMany({ where: { id: application.id, status: "PENDING" }, data: { status: decision, reviewerId: actorId, reviewedAt: now, note } });
    if (reviewed.count !== 1) throw registrationError("Application is no longer pending", 409);
    const updated = await tx.user.updateMany({ where: { id: application.applicantId, status: "PENDING_FACULTY_APPROVAL", role: "STUDENT" }, data: decision === "APPROVED" ? { role: "FACULTY", status: "ACTIVE", employeeId: application.employeeId } : { status: "REJECTED" } });
    if (updated.count !== 1) throw registrationError("Applicant is no longer pending", 409);
    return tx.facultyApplication.findUnique({ where: { id: application.id }, select: applicationSelect });
  });
}

type RegistryRow = { enrollmentNo: string; email: string; active: boolean };
export function parseRegistryImport(input: unknown): RegistryRow[] {
  const body = objectInput(input);
  if (Object.keys(body).some(key => key !== "records") || !Array.isArray(body.records) || body.records.length < 1 || body.records.length > 1000) throw registrationError("Supply records containing 1–1000 student registry rows");
  const enrollmentNumbers = new Set<string>();
  const emails = new Set<string>();
  return body.records.map(raw => {
    const row = objectInput(raw);
    if (Object.keys(row).some(key => !["enrollmentNo", "email", "active"].includes(key)) || (row.active !== undefined && typeof row.active !== "boolean")) throw registrationError("Registry rows accept only enrollmentNo, email and optional boolean active");
    const enrollmentNo = normalizeIdentifier(row.enrollmentNo, "Enrollment number");
    const email = normalizeEmail(row.email);
    if (enrollmentNumbers.has(enrollmentNo) || emails.has(email)) throw registrationError("Registry import contains duplicate enrollment numbers or emails");
    enrollmentNumbers.add(enrollmentNo);
    emails.add(email);
    return { enrollmentNo, email, active: row.active ?? true } as RegistryRow;
  });
}

/** Atomic upsert only: absent records are retained and claims can never be reset by import. */
export async function importStudentRegistry(actorId: string, input: unknown) {
  const rows = parseRegistryImport(input);
  return registrationTransaction(async tx => {
    await requireAdmin(tx, actorId);
    for (const row of rows) {
      const existing = await tx.studentRegistry.findUnique({ where: { enrollmentNo: row.enrollmentNo }, include: { applicant: { select: { id: true } } } });
      if (existing && (existing.claimed || existing.claimedAt || existing.applicant) && existing.email !== row.email) throw registrationError("A reserved or claimed student identity cannot be replaced", 409);
      const emailOwner = await tx.studentRegistry.findUnique({ where: { email: row.email } });
      if (emailOwner && emailOwner.id !== existing?.id) throw registrationError("Email is already assigned to another enrollment number", 409);
      await tx.studentRegistry.upsert({ where: { enrollmentNo: row.enrollmentNo }, create: row, update: { email: row.email, active: row.active } });
    }
    return { imported: rows.length, mode: "UPSERT" as const };
  });
}
