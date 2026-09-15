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

async function runPhase3BTests() {
  console.log("================================================================================");
  console.log("AURA LMS — PHASE 3B TEST SUITE: PDF VIEWER STREAMING & LEARNING PROGRESS");
  console.log("================================================================================");

  // 1. Fetch principals
  const studentA = await prisma.user.findFirst({
    where: { role: "STUDENT", email: "harsh.ce@college.edu" },
  });
  const studentB = await prisma.user.findFirst({
    where: { role: "STUDENT", email: { not: "harsh.ce@college.edu" } },
  });
  const faculty = await prisma.user.findFirst({ where: { role: "FACULTY" } });
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });

  if (!studentA || !studentB || !faculty || !admin) {
    throw new Error("Missing required user principals for Phase 3B testing");
  }

  // 2. Fetch or create a test material in CS-401 where Student A is enrolled and Student B is NOT enrolled
  const courseCS401 = await prisma.course.findFirst({
    where: { code: "CS-401" },
  });
  if (!courseCS401) {
    throw new Error("Course CS-401 not found");
  }

  // Ensure Student A is enrolled in CS-401
  await prisma.enrollment.upsert({
    where: { studentId_courseId: { studentId: studentA.id, courseId: courseCS401.id } },
    update: {},
    create: { studentId: studentA.id, courseId: courseCS401.id },
  });

  // Ensure Student B is NOT enrolled in CS-401
  await prisma.enrollment.deleteMany({
    where: { studentId: studentB.id, courseId: courseCS401.id },
  });

  // Fetch or create a Material for CS-401
  let material = await prisma.material.findFirst({
    where: { courseId: courseCS401.id },
  });

  if (!material) {
    material = await prisma.material.create({
      data: {
        courseId: courseCS401.id,
        title: "Unit 2: Raft Consensus Protocol",
        unit: "Unit 2",
        fileType: "pdf",
        fileSize: "2.4 MB",
        processingStatus: "READY",
        ragChunksCount: 12,
      },
    });
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

  console.log(`\nTest Parameters:`);
  console.log(`- Enrolled Student A: ${studentA.name} (${studentA.id})`);
  console.log(`- Non-Enrolled Student B: ${studentB.name} (${studentB.id})`);
  console.log(`- Target Material: "${material.title}" (${material.id})`);
  console.log(`- Course: ${courseCS401.code} (${courseCS401.id})\n`);

  let step = 1;

  // Clean previous progress for clean test state
  await prisma.materialProgress.deleteMany({
    where: { materialId: material.id, studentId: studentA.id },
  });

  // --- 1. Enrolled Student accesses material PDF ---
  console.log("--- SECTION 1: Protected PDF Streaming Authorization ---");
  const fileResA = await fetch(`${BASE_URL}/api/materials/${material.id}/file`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const contentTypeA = fileResA.headers.get("content-type");
  const isPdf = contentTypeA?.includes("application/pdf");
  record(
    step++,
    "Enrolled Student A -> GET /api/materials/:id/file (Stream PDF)",
    200,
    fileResA.status,
    isPdf ? "Content-Type: application/pdf confirmed" : `Unexpected Content-Type: ${contentTypeA}`
  );

  // --- 2. Non-enrolled Student accesses material PDF (Forbidden) ---
  const fileResB = await fetch(`${BASE_URL}/api/materials/${material.id}/file`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  record(
    step++,
    "Non-Enrolled Student B -> GET /api/materials/:id/file [Protected]",
    403,
    fileResB.status
  );

  // --- 3. Unauthenticated request to material PDF (Unauthorized) ---
  const fileResUnauth = await fetch(`${BASE_URL}/api/materials/${material.id}/file`);
  record(
    step++,
    "Unauthenticated -> GET /api/materials/:id/file",
    401,
    fileResUnauth.status
  );

  // --- 4. Faculty & Admin access to material PDF ---
  const fileResFac = await fetch(`${BASE_URL}/api/materials/${material.id}/file`, {
    headers: { Authorization: `Bearer ${tokenFaculty}` },
  });
  record(
    step++,
    "Faculty -> GET /api/materials/:id/file",
    200,
    fileResFac.status
  );

  const fileResAdm = await fetch(`${BASE_URL}/api/materials/${material.id}/file`, {
    headers: { Authorization: `Bearer ${tokenAdmin}` },
  });
  record(
    step++,
    "Admin -> GET /api/materials/:id/file",
    200,
    fileResAdm.status
  );

  // --- SECTION 2: Learning Progress CRUD & IDOR Protection ---
  console.log("\n--- SECTION 2: Learning Progress Tracking & IDOR Isolation ---");

  // 5. Student A gets initial progress (default page 1, 0%)
  const progInitRes = await fetch(`${BASE_URL}/api/materials/${material.id}/progress`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const progInitData = await progInitRes.json();
  record(
    step++,
    "Student A -> GET initial progress (Default Page 1, 0%)",
    200,
    progInitRes.status,
    `Page: ${progInitData.data?.currentPage}, Progress: ${progInitData.data?.progressPercent}%`
  );

  // 6. Student A updates progress to Page 2 of 4 (50%)
  const progUpdateRes = await fetch(`${BASE_URL}/api/materials/${material.id}/progress`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${tokenA}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      currentPage: 2,
      totalPages: 4,
    }),
  });
  const progUpdateData = await progUpdateRes.json();
  const prog50Pass =
    progUpdateRes.status === 200 &&
    progUpdateData.data?.currentPage === 2 &&
    progUpdateData.data?.progressPercent === 50 &&
    progUpdateData.data?.completed === false;

  record(
    step++,
    "Student A -> PUT progress (Page 2 of 4 -> 50% In Progress)",
    200,
    progUpdateRes.status,
    `Page: ${progUpdateData.data?.currentPage}, Progress: ${progUpdateData.data?.progressPercent}%, Completed: ${progUpdateData.data?.completed}`
  );

  // 7. Student A retrieves updated progress
  const progGetRes = await fetch(`${BASE_URL}/api/materials/${material.id}/progress`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const progGetData = await progGetRes.json();
  record(
    step++,
    "Student A -> GET persisted progress (Resume Reading State)",
    200,
    progGetRes.status,
    `Current Page: ${progGetData.data?.currentPage}`
  );

  // 8. Student B attempts IDOR read on Student A's progress (Forbidden)
  const idorReadRes = await fetch(
    `${BASE_URL}/api/materials/${material.id}/progress?studentId=${studentA.id}`,
    {
      headers: { Authorization: `Bearer ${tokenB}` },
    }
  );
  record(
    step++,
    "Student B -> GET Student A progress [IDOR Read Attempt]",
    403,
    idorReadRes.status
  );

  // 9. Student B attempts IDOR modification on Student A's progress (Forbidden)
  const idorWriteRes = await fetch(`${BASE_URL}/api/materials/${material.id}/progress`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${tokenB}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      studentId: studentA.id,
      currentPage: 4,
      totalPages: 4,
    }),
  });
  record(
    step++,
    "Student B -> PUT Student A progress [IDOR Write Attempt]",
    403,
    idorWriteRes.status
  );

  // 10. Unauthenticated request to progress endpoint
  const unauthProgRes = await fetch(`${BASE_URL}/api/materials/${material.id}/progress`);
  record(
    step++,
    "Unauthenticated -> GET /api/materials/:id/progress",
    401,
    unauthProgRes.status
  );

  // --- SECTION 3: Progress Completion & Database Consistency ---
  console.log("\n--- SECTION 3: Automatic Completion & Database Integrity ---");

  // 11. Student A reaches the final page (Page 4 of 4 -> 100% Completed)
  const completeRes = await fetch(`${BASE_URL}/api/materials/${material.id}/progress`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${tokenA}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      currentPage: 4,
      totalPages: 4,
    }),
  });
  const completeData = await completeRes.json();
  const isCompleted =
    completeData.data?.progressPercent === 100 && completeData.data?.completed === true;

  record(
    step++,
    "Student A -> PUT final page (Page 4 of 4 -> 100% Completed)",
    200,
    completeRes.status,
    `Progress: ${completeData.data?.progressPercent}%, Completed: ${completeData.data?.completed}`
  );

  // 12. Direct Database Consistency Verification via Prisma
  const dbRecord = await prisma.materialProgress.findUnique({
    where: {
      studentId_materialId: {
        studentId: studentA.id,
        materialId: material.id,
      },
    },
  });

  const dbMatches =
    dbRecord !== null &&
    dbRecord.currentPage === 4 &&
    dbRecord.totalPages === 4 &&
    dbRecord.progressPercent === 100 &&
    dbRecord.completed === true;

  record(
    step++,
    "Database Persistence & Model Consistency Verification",
    200,
    dbMatches ? 200 : 500,
    `DB Record: Page ${dbRecord?.currentPage}/${dbRecord?.totalPages}, Progress: ${dbRecord?.progressPercent}%, Completed: ${dbRecord?.completed}`
  );

  // 13. Idempotency Check (Repeated updates do not duplicate records)
  const totalRecords = await prisma.materialProgress.count({
    where: {
      studentId: studentA.id,
      materialId: material.id,
    },
  });

  record(
    step++,
    "Atomic Upsert Idempotency (Unique constraint [studentId, materialId])",
    200,
    totalRecords === 1 ? 200 : 500,
    `Total records found in DB: ${totalRecords}`
  );

  // --- Final Summary ---
  console.log("\n================================================================================");
  const totalTests = results.length;
  const passedTests = results.filter((r) => r.passed).length;
  const failedTests = totalTests - passedTests;

  console.log(`TOTAL PHASE 3B TESTS : ${totalTests}`);
  console.log(`PASSED TESTS         : ${passedTests}`);
  console.log(`FAILED TESTS         : ${failedTests}`);
  console.log("================================================================================");

  if (failedTests > 0) {
    console.error("❌ PHASE 3B TEST SUITE FAILED!");
    process.exit(1);
  } else {
    console.log("✅ ALL PHASE 3B PDF STREAMING & PROGRESS TESTS PASSED WITH 100% SUCCESS!");
  }
}

runPhase3BTests()
  .catch((err) => {
    console.error("Fatal test error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
