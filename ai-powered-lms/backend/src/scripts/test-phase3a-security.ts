import "dotenv/config";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";

const BASE_URL = process.env.BACKEND_URL || "http://localhost:5000";

interface TestResult {
  step: number;
  description: string;
  expectedStatus: number;
  actualStatus: number;
  passed: boolean;
  notes?: string;
}

const results: TestResult[] = [];

function record(
  step: number,
  description: string,
  expectedStatus: number,
  actualStatus: number,
  notes?: string
) {
  const passed = expectedStatus === actualStatus;
  results.push({ step, description, expectedStatus, actualStatus, passed, notes });
  const icon = passed ? "✅ PASS" : "❌ FAIL";
  console.log(
    `[${icon}] Step ${step.toString().padStart(2, "0")}: ${description} (Expected ${expectedStatus}, Got ${actualStatus})`
  );
  if (!passed && notes) {
    console.error(`       Details: ${notes}`);
  }
}

async function runSecurityTests() {
  console.log("================================================================================");
  console.log("AURA LMS — PHASE 3A SECURITY TEST SUITE: STUDENT IDOR PROTECTION");
  console.log("================================================================================");

  // 1. Fetch user accounts from PostgreSQL
  const studentA = await prisma.user.findFirst({
    where: { role: "STUDENT", email: "harsh.ce@college.edu" },
  });
  const studentB = await prisma.user.findFirst({
    where: { role: "STUDENT", email: { not: "harsh.ce@college.edu" } },
  });
  const faculty = await prisma.user.findFirst({ where: { role: "FACULTY" } });
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });

  if (!studentA || !studentB || !faculty || !admin) {
    throw new Error(
      `Required test accounts not found in database: ` +
        `studentA=${!!studentA}, studentB=${!!studentB}, faculty=${!!faculty}, admin=${!!admin}`
    );
  }

  const secret = process.env.JWT_SECRET!;
  const tokenA = jwt.sign({ userId: studentA.id, email: studentA.email, role: studentA.role }, secret, {
    expiresIn: "1h",
  });
  const tokenB = jwt.sign({ userId: studentB.id, email: studentB.email, role: studentB.role }, secret, {
    expiresIn: "1h",
  });
  const tokenFaculty = jwt.sign({ userId: faculty.id, email: faculty.email, role: faculty.role }, secret, {
    expiresIn: "1h",
  });
  const tokenAdmin = jwt.sign({ userId: admin.id, email: admin.email, role: admin.role }, secret, {
    expiresIn: "1h",
  });

  console.log(`\nTest Principal Identities:`);
  console.log(`- Student A: ${studentA.name} (${studentA.id})`);
  console.log(`- Student B: ${studentB.name} (${studentB.id})`);
  console.log(`- Faculty:   ${faculty.name} (${faculty.id})`);
  console.log(`- Admin:     ${admin.name} (${admin.id})\n`);

  let stepCounter = 1;

  // Helper fetcher
  async function testRoute(
    desc: string,
    path: string,
    token: string | null,
    expectedStatus: number
  ) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const res = await fetch(`${BASE_URL}${path}`, { method: "GET", headers });
      const body = await res.json().catch(() => ({}));
      const note = !res.ok ? JSON.stringify(body) : undefined;
      record(stepCounter++, desc, expectedStatus, res.status, note);
    } catch (err: any) {
      record(stepCounter++, desc, expectedStatus, 500, err?.message);
    }
  }

  // --- MATRIX 1: Student A Self Access (Legitimate) ---
  console.log("--- SECTION 1: Student Self Access (Legitimate Ownership) ---");
  await testRoute("Student A -> GET /api/students/:id_A/courses", `/api/students/${studentA.id}/courses`, tokenA, 200);
  await testRoute("Student A -> GET /api/students/:id_A/performance", `/api/students/${studentA.id}/performance`, tokenA, 200);
  await testRoute("Student A -> GET /api/students/:id_A/weak-topics", `/api/students/${studentA.id}/weak-topics`, tokenA, 200);
  await testRoute("Student A -> GET /api/students/:id_A/recommendations", `/api/students/${studentA.id}/recommendations`, tokenA, 200);
  await testRoute("Student A -> GET /api/students/:id_A/quiz-attempts", `/api/students/${studentA.id}/quiz-attempts`, tokenA, 200);
  await testRoute("Student A -> GET /api/students/:id_A", `/api/students/${studentA.id}`, tokenA, 200);
  await testRoute("Student A -> GET /api/analytics/student/:id_A", `/api/analytics/student/${studentA.id}`, tokenA, 200);

  // --- MATRIX 2: Student A attempting IDOR access to Student B ---
  console.log("\n--- SECTION 2: Student A Attempting IDOR on Student B (Forbidden 403) ---");
  await testRoute("Student A -> GET /api/students/:id_B/courses [IDOR]", `/api/students/${studentB.id}/courses`, tokenA, 403);
  await testRoute("Student A -> GET /api/students/:id_B/performance [IDOR]", `/api/students/${studentB.id}/performance`, tokenA, 403);
  await testRoute("Student A -> GET /api/students/:id_B/weak-topics [IDOR]", `/api/students/${studentB.id}/weak-topics`, tokenA, 403);
  await testRoute("Student A -> GET /api/students/:id_B/recommendations [IDOR]", `/api/students/${studentB.id}/recommendations`, tokenA, 403);
  await testRoute("Student A -> GET /api/students/:id_B/quiz-attempts [IDOR]", `/api/students/${studentB.id}/quiz-attempts`, tokenA, 403);
  await testRoute("Student A -> GET /api/students/:id_B [IDOR]", `/api/students/${studentB.id}`, tokenA, 403);
  await testRoute("Student A -> GET /api/analytics/student/:id_B [IDOR]", `/api/analytics/student/${studentB.id}`, tokenA, 403);

  // --- MATRIX 3: Student B attempting IDOR access to Student A ---
  console.log("\n--- SECTION 3: Student B Attempting IDOR on Student A (Forbidden 403) ---");
  await testRoute("Student B -> GET /api/students/:id_A/performance [IDOR]", `/api/students/${studentA.id}/performance`, tokenB, 403);
  await testRoute("Student B -> GET /api/students/:id_A/weak-topics [IDOR]", `/api/students/${studentA.id}/weak-topics`, tokenB, 403);

  // --- MATRIX 4: Unauthenticated Caller (Unauthorized 401) ---
  console.log("\n--- SECTION 4: Unauthenticated Request (Unauthorized 401) ---");
  await testRoute("Unauthenticated -> GET /api/students/:id_A/performance", `/api/students/${studentA.id}/performance`, null, 401);
  await testRoute("Unauthenticated -> GET /api/students/:id_A/courses", `/api/students/${studentA.id}/courses`, null, 401);

  // --- MATRIX 5: Faculty Authorized Access ---
  console.log("\n--- SECTION 5: Faculty Authorized Access (Preserved 200) ---");
  await testRoute("Faculty -> GET /api/students/:id_A/performance", `/api/students/${studentA.id}/performance`, tokenFaculty, 200);
  await testRoute("Faculty -> GET /api/students/:id_A/courses", `/api/students/${studentA.id}/courses`, tokenFaculty, 200);
  await testRoute("Faculty -> GET /api/analytics/student/:id_A", `/api/analytics/student/${studentA.id}`, tokenFaculty, 200);

  // --- MATRIX 6: Admin Institutional Oversight ---
  console.log("\n--- SECTION 6: Admin Institutional Access (Preserved 200) ---");
  await testRoute("Admin -> GET /api/students/:id_A/performance", `/api/students/${studentA.id}/performance`, tokenAdmin, 200);
  await testRoute("Admin -> GET /api/students/:id_B/courses", `/api/students/${studentB.id}/courses`, tokenAdmin, 200);
  await testRoute("Admin -> GET /api/analytics/student/:id_B", `/api/analytics/student/${studentB.id}`, tokenAdmin, 200);

  // --- Final Summary ---
  console.log("\n================================================================================");
  const totalTests = results.length;
  const passedTests = results.filter((r) => r.passed).length;
  const failedTests = totalTests - passedTests;

  console.log(`TOTAL SECURITY TESTS : ${totalTests}`);
  console.log(`PASSED TESTS         : ${passedTests}`);
  console.log(`FAILED TESTS         : ${failedTests}`);
  console.log("================================================================================");

  if (failedTests > 0) {
    console.error("❌ PHASE 3A SECURITY TEST SUITE FAILED!");
    process.exit(1);
  } else {
    console.log("✅ ALL 22 SECURITY & IDOR CHECKS PASSED WITH 100% SUCCESS!");
  }
}

runSecurityTests()
  .catch((err) => {
    console.error("FATAL ERROR in security test runner:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
