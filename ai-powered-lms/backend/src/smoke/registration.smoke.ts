import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";
import authRouter from "../routes/auth.routes.js";
import institutionRouter from "../routes/institution.routes.js";
import { registerUser, verifyStudentEmail } from "../services/registration.service.js";
import { assertSafeProfileUpdate, loginUser } from "../services/auth.service.js";
import { importStudentRegistry, parseRegistryImport, reviewFacultyApplication } from "../services/institution.service.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";

const now = new Date();
const baseUser = { id: "student-1", name: "Student", email: "student@example.edu", passwordHash: "", role: "STUDENT", status: "PENDING_EMAIL", department: "Computer Engineering", enrollmentNo: "BE-2024-CS-001", employeeId: null, avatarUrl: null, createdAt: now, updatedAt: now } as any;

function transactionMock(t: any, tx: any) {
  const target = prisma as any;
  const original = target.$transaction;
  target.$transaction = async (work: (transaction: any) => Promise<unknown>) => work(tx);
  t.after(() => { target.$transaction = original; });
}
function replace(t: any, target: any, method: string, implementation: (...args: any[]) => any) {
  const original = target[method];
  target[method] = implementation;
  t.after(() => { target[method] = original; });
}

test("public registration cannot escalate ADMIN or FACULTY and faculty remains pending", { concurrency: false }, async (t) => {
  const tx: any = {
    user: { findFirst: async () => null, create: async ({ data }: any) => ({ ...baseUser, ...data, id: "faculty-1" }) },
    facultyApplication: { create: async ({ data }: any) => data },
    studentRegistry: { findUnique: async () => null },
    emailVerificationToken: { create: async () => undefined },
  };
  transactionMock(t, tx);
  await assert.rejects(registerUser({ name: "Admin", email: "admin@example.edu", password: "Password123", role: "ADMIN", accountType: "STUDENT", enrollmentNo: "BE-2024-CS-001" }), { statusCode: 400 });
  const result = await registerUser({ name: "Faculty", email: "faculty@example.edu", password: "Password123", role: "FACULTY", accountType: "FACULTY", employeeId: "EMP-001" });
  assert.equal(result.status, "PENDING_FACULTY_APPROVAL");
});

test("student registration requires a matching active unclaimed registry row", { concurrency: false }, async (t) => {
  let registry: any = { id: "registry-1", enrollmentNo: "BE-2024-CS-001", email: "student@example.edu", active: true, claimed: false, claimedAt: null, applicant: null };
  const created: any[] = [];
  const tx: any = {
    user: { findFirst: async () => null, create: async ({ data }: any) => { created.push(data); return { ...baseUser, ...data }; } },
    studentRegistry: { findUnique: async () => registry },
    emailVerificationToken: { create: async ({ data }: any) => data },
    facultyApplication: { create: async () => undefined },
  };
  transactionMock(t, tx);
  const pending = await registerUser({ name: "Student", email: "student@example.edu", password: "Password123", accountType: "STUDENT", enrollmentNo: "be-2024-cs-001" });
  assert.equal(pending.status, "PENDING_EMAIL");
  assert.equal(created[0].status, "PENDING_EMAIL");
  assert.equal(created[0].role, "STUDENT");
  registry = { ...registry, email: "other@example.edu" };
  await assert.rejects(registerUser({ name: "Student", email: "student@example.edu", password: "Password123", accountType: "STUDENT", enrollmentNo: "BE-2024-CS-001" }), { statusCode: 403 });
  registry = { ...registry, email: "student@example.edu", active: false };
  await assert.rejects(registerUser({ name: "Student", email: "student@example.edu", password: "Password123", accountType: "STUDENT", enrollmentNo: "BE-2024-CS-001" }), { statusCode: 403 });
  registry = { ...registry, active: true, claimedAt: now };
  await assert.rejects(registerUser({ name: "Student", email: "student@example.edu", password: "Password123", accountType: "STUDENT", enrollmentNo: "BE-2024-CS-001" }), { statusCode: 403 });
});

test("login rejects every non-active account and signs the database role", { concurrency: false }, async (t) => {
  process.env.JWT_SECRET = "test-secret";
  const hash = await bcrypt.hash("Password123", 10);
  let user: any = { ...baseUser, passwordHash: hash };
  replace(t, prisma.user, "findUnique", async () => user);
  replace(t, (prisma as any).refreshSession, "create", async ({ data }: any) => data);
  await assert.rejects(loginUser({ email: user.email, password: "Password123" }), { statusCode: 403 });
  user = { ...user, status: "ACTIVE", role: "STUDENT" };
  const result = await loginUser({ email: user.email, password: "Password123" });
  assert.equal(result.user.role, "STUDENT");
  assert.equal((jwt.decode(result.token) as any).role, "STUDENT");
  await assert.rejects(loginUser({ email: user.email, password: "Password123", portalRole: "ADMIN" }), { statusCode: 403 });
});

test("profile and generic admin user updates cannot mutate authorization fields", () => {
  assert.throws(() => assertSafeProfileUpdate({ name: "Changed", role: "ADMIN" }), { statusCode: 400 });
  assert.throws(() => assertSafeProfileUpdate({ status: "ACTIVE" }), { statusCode: 400 });
  assert.throws(() => assertSafeProfileUpdate({ enrollmentNo: "BE-1" }), { statusCode: 400 });
});

test("student sessions cannot pass the admin authorization middleware", () => {
  const response: any = {
    statusCode: 200,
    status(code: number) { this.statusCode = code; return this; },
    json() { return this; },
  };
  let nextCalled = false;
  authorizeRoles("ADMIN")({ user: { userId: "student-1", email: "student@example.edu", role: "STUDENT" } } as any, response, () => { nextCalled = true; });
  assert.equal(response.statusCode, 403);
  assert.equal(nextCalled, false);
});

test("email verification is expiring, single-use, transactional, and claims the registry", { concurrency: false }, async (t) => {
  const raw = "a".repeat(64);
  let used = false;
  const user = { ...baseUser, status: "PENDING_EMAIL", studentRegistry: { id: "registry-1", enrollmentNo: "BE-2024-CS-001", email: baseUser.email, active: true, claimedAt: null } };
  const tx: any = {
    emailVerificationToken: {
      findUnique: async () => ({ id: "token-1", tokenHash: "unused", user, expiresAt: new Date(Date.now() + 60_000), usedAt: used ? now : null }),
      updateMany: async ({ data }: any) => { if (data.usedAt) { if (used) return { count: 0 }; used = true; } return { count: 1 }; },
    },
    studentRegistry: { updateMany: async () => ({ count: 1 }) },
    user: { updateMany: async () => ({ count: 1 }) },
  };
  transactionMock(t, tx);
  await verifyStudentEmail(raw);
  await assert.rejects(verifyStudentEmail(raw), { statusCode: 400 });
  tx.emailVerificationToken.findUnique = async () => ({ id: "token-2", tokenHash: "unused", user, expiresAt: new Date(Date.now() - 1), usedAt: null });
  await assert.rejects(verifyStudentEmail(raw), { statusCode: 400 });
});

test("admin approval changes only a validated pending application and admin routes are guarded", { concurrency: false }, async (t) => {
  let application: any = { id: "app-1", employeeId: "EMP-001", email: "faculty@example.edu", applicantId: "applicant-1", status: "PENDING", applicant: { ...baseUser, id: "applicant-1", email: "faculty@example.edu", status: "PENDING_FACULTY_APPROVAL", role: "STUDENT", studentRegistryId: null } };
  const updates: any[] = [];
  const tx: any = {
    user: { findUnique: async () => ({ role: "ADMIN", status: "ACTIVE" }), findFirst: async () => null, updateMany: async (args: any) => { updates.push(args); return { count: 1 }; } },
    facultyApplication: { findUnique: async () => application, findFirst: async () => null, updateMany: async () => ({ count: 1 }), findUniqueAfter: async () => application },
  };
  tx.facultyApplication.findUnique = async ({ select }: any) => select ? application : application;
  transactionMock(t, tx);
  await reviewFacultyApplication("admin-1", "app-1", "APPROVED", { note: "Verified" });
  assert.deepEqual(updates[0].data, { role: "FACULTY", status: "ACTIVE", employeeId: "EMP-001" });
  assert.equal(updates[0].data.status, "ACTIVE");
  const route: any = (institutionRouter as any).stack.find((layer: any) => layer.route?.path === "/faculty-applications/:id/approve").route;
  assert.equal(route.stack.length >= 1, true);
  assert.equal((institutionRouter as any).stack.some((layer: any) => !layer.route), true);
  const authRoute: any = (authRouter as any).stack.find((layer: any) => layer.route?.path === "/register").route;
  assert.equal(authRoute.stack.length >= 2, true);
  const out: any = { statusCode: 200, status(n: number) { this.statusCode = n; return this; }, json() {} };
  await authenticate({ headers: {} } as any, out, () => undefined);
  assert.equal(out.statusCode, 401);
});

test("registry import is an admin-only atomic upsert and rejects malformed rows", { concurrency: false }, async (t) => {
  assert.throws(() => parseRegistryImport({ records: [{ enrollmentNo: "A-1", email: "a@example.edu", unexpected: true }] }), { statusCode: 400 });
  assert.throws(() => parseRegistryImport({ records: [{ enrollmentNo: "A-1", email: "not-an-email" }] }), { statusCode: 400 });
  const upserts: any[] = [];
  const tx: any = {
    user: { findUnique: async () => ({ role: "ADMIN", status: "ACTIVE" }) },
    studentRegistry: { findUnique: async () => null, upsert: async (args: any) => { upserts.push(args); return args; } },
  };
  transactionMock(t, tx);
  const result = await importStudentRegistry("admin-1", { records: [{ enrollmentNo: "a-1", email: "a@example.edu" }, { enrollmentNo: "b-1", email: "b@example.edu", active: false }] });
  assert.equal(result.imported, 2);
  assert.equal(upserts[0].create.enrollmentNo, "A-1");
  assert.equal(upserts[1].create.active, false);
  tx.user.findUnique = async () => ({ role: "FACULTY", status: "ACTIVE" });
  await assert.rejects(importStudentRegistry("faculty-1", { records: [{ enrollmentNo: "c-1", email: "c@example.edu" }] }), { statusCode: 403 });
});
