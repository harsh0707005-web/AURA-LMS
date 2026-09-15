import "dotenv/config";
import prisma from "../lib/prisma.js";

const BASE_URL = "http://localhost:5000/api";

interface TestResult {
  phase: string;
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const auditResults: TestResult[] = [];

function record(phase: string, name: string, passed: boolean, error?: string, details?: any) {
  auditResults.push({ phase, name, passed, error, details });
  const status = passed ? "PASS" : "FAIL";
  console.log(`[${status}] ${phase} - ${name}`);
  if (error) console.log(`       Error: ${error}`);
}

async function runFullAudit() {
  console.log("==================================================================");
  console.log("AURA LMS: COMPREHENSIVE END-TO-END AUDIT & VERIFICATION SUITE");
  console.log("==================================================================");

  const timestamp = Date.now();
  const testEmail = `aura.ui.test.${timestamp}@aura-lms.local`;
  const testPassword = "TestPassword123!";
  const testEnrollment = `AURA-UI-${timestamp}`;

  let studentToken = "";
  let studentUserId = "";
  let demoStudentToken = "";
  let demoStudentId = "";
  let facultyToken = "";
  let facultyId = "";
  let adminToken = "";

  // ---------------------------------------------------------
  // PHASE 1: AUTHENTICATION & REGISTRATION
  // ---------------------------------------------------------
  console.log("\n--- PHASE 1: AUTHENTICATION & REGISTRATION ---");

  // Test 1.1: Register new student
  try {
    const regRes = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "AURA UI Test Student",
        email: testEmail,
        password: testPassword,
        role: "STUDENT",
        department: "Computer Engineering",
        enrollmentNo: testEnrollment,
      }),
    });
    const regData = await regRes.json();
    if (regRes.status === 201 && regData.success && regData.data?.id) {
      studentUserId = regData.data.id;
      record("PHASE 1", "Register New Student Account", true);
    } else {
      record("PHASE 1", "Register New Student Account", false, `Status ${regRes.status}: ${JSON.stringify(regData)}`);
    }
  } catch (err: any) {
    record("PHASE 1", "Register New Student Account", false, err.message);
  }

  // Test 1.2: Duplicate email registration rejection
  try {
    const dupRes = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Duplicate Student",
        email: testEmail,
        password: testPassword,
        role: "STUDENT",
      }),
    });
    const dupData = await dupRes.json();
    if (dupRes.status === 409) {
      record("PHASE 1", "Reject Duplicate Email Registration (409 Conflict)", true);
    } else {
      record("PHASE 1", "Reject Duplicate Email Registration (409 Conflict)", false, `Expected 409, got ${dupRes.status}`);
    }
  } catch (err: any) {
    record("PHASE 1", "Reject Duplicate Email Registration (409 Conflict)", false, err.message);
  }

  // Test 1.3: Reject Admin Public Registration
  try {
    const adminRegRes = await fetch(`${BASE_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Hacker Admin",
        email: `hacker.${timestamp}@college.edu`,
        password: testPassword,
        role: "ADMIN",
      }),
    });
    if (adminRegRes.status === 400) {
      record("PHASE 1", "Prohibit Public Registration as ADMIN (400 Bad Request)", true);
    } else {
      record("PHASE 1", "Prohibit Public Registration as ADMIN (400 Bad Request)", false, `Expected 400, got ${adminRegRes.status}`);
    }
  } catch (err: any) {
    record("PHASE 1", "Prohibit Public Registration as ADMIN (400 Bad Request)", false, err.message);
  }

  // Test 1.4: Login with newly created student
  try {
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });
    const loginData = await loginRes.json();
    if (loginRes.status === 200 && loginData.success && loginData.data?.token) {
      studentToken = loginData.data.token;
      record("PHASE 1", "Login with Newly Created Student Account", true);
    } else {
      record("PHASE 1", "Login with Newly Created Student Account", false, `Status ${loginRes.status}: ${JSON.stringify(loginData)}`);
    }
  } catch (err: any) {
    record("PHASE 1", "Login with Newly Created Student Account", false, err.message);
  }

  // Test 1.5: Login with Demo Student
  try {
    const demoRes = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "harsh.ce@college.edu",
        password: "Password123",
      }),
    });
    const demoData = await demoRes.json();
    if (demoRes.status === 200 && demoData.success && demoData.data?.token) {
      demoStudentToken = demoData.data.token;
      demoStudentId = demoData.data.user.id;
      record("PHASE 1", "Login with Existing Demo Student (harsh.ce@college.edu)", true);
    } else {
      record("PHASE 1", "Login with Existing Demo Student (harsh.ce@college.edu)", false, `Status ${demoRes.status}`);
    }
  } catch (err: any) {
    record("PHASE 1", "Login with Existing Demo Student (harsh.ce@college.edu)", false, err.message);
  }

  // Test 1.6: Login with Demo Faculty
  try {
    const facRes = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "dr.rajesh@college.edu",
        password: "Password123",
      }),
    });
    const facData = await facRes.json();
    if (facRes.status === 200 && facData.success && facData.data?.token) {
      facultyToken = facData.data.token;
      facultyId = facData.data.user.id;
      record("PHASE 1", "Login with Demo Faculty (dr.rajesh@college.edu)", true);
    } else {
      record("PHASE 1", "Login with Demo Faculty (dr.rajesh@college.edu)", false, `Status ${facRes.status}`);
    }
  } catch (err: any) {
    record("PHASE 1", "Login with Demo Faculty (dr.rajesh@college.edu)", false, err.message);
  }

  // Test 1.7: Login with Demo Admin
  try {
    const admRes = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin.ce@college.edu",
        password: "Password123",
      }),
    });
    const admData = await admRes.json();
    if (admRes.status === 200 && admData.success && admData.data?.token) {
      adminToken = admData.data.token;
      record("PHASE 1", "Login with Demo Admin (admin.ce@college.edu)", true);
    } else {
      record("PHASE 1", "Login with Demo Admin (admin.ce@college.edu)", false, `Status ${admRes.status}`);
    }
  } catch (err: any) {
    record("PHASE 1", "Login with Demo Admin (admin.ce@college.edu)", false, err.message);
  }

  // Test 1.8: GET /auth/me with Bearer token
  try {
    const meRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const meData = await meRes.json();
    if (meRes.status === 200 && meData.success && meData.data?.id === studentUserId) {
      record("PHASE 1", "Authenticated Session Verification (GET /auth/me)", true);
    } else {
      record("PHASE 1", "Authenticated Session Verification (GET /auth/me)", false, `Status ${meRes.status}`);
    }
  } catch (err: any) {
    record("PHASE 1", "Authenticated Session Verification (GET /auth/me)", false, err.message);
  }

  // ---------------------------------------------------------
  // PHASE 2 & 3: AI COURSE TUTOR & GEMINI RAG
  // ---------------------------------------------------------
  console.log("\n--- PHASE 2 & 3: AI COURSE TUTOR & GEMINI RAG ---");

  let cs401CourseId = "";
  try {
    const course = await prisma.course.findUnique({ where: { code: "CS-401" } });
    if (course) {
      cs401CourseId = course.id;
    }
  } catch (e: any) {
    console.error("Failed to query CS-401:", e.message);
  }

  let testConversationId = "";
  // Test 2.1: Create AI Conversation for CS-401
  try {
    const convoRes = await fetch(`${BASE_URL}/ai/conversations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${demoStudentToken}`,
      },
      body: JSON.stringify({
        courseId: cs401CourseId,
        title: "Audit Test: Raft Consensus",
      }),
    });
    const convoData = await convoRes.json();
    if (convoRes.status === 201 && convoData.success && convoData.data?.id) {
      testConversationId = convoData.data.id;
      record("PHASE 2", "Create AI Conversation for Course", true);
    } else {
      record("PHASE 2", "Create AI Conversation for Course", false, `Status ${convoRes.status}: ${JSON.stringify(convoData)}`);
    }
  } catch (err: any) {
    record("PHASE 2", "Create AI Conversation for Course", false, err.message);
  }

  // Test 2.2: Post grounded course question to AI Tutor
  try {
    const questionText = "How does Raft elect a leader and prevent split votes?";
    const msgRes = await fetch(`${BASE_URL}/ai/conversations/${testConversationId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${demoStudentToken}`,
      },
      body: JSON.stringify({ content: questionText }),
    });
    const msgData = await msgRes.json();
    if (
      msgRes.status === 201 &&
      msgData.success &&
      msgData.data?.assistantMessage?.content &&
      Array.isArray(msgData.data?.assistantMessage?.sources) &&
      msgData.data.assistantMessage.sources.length > 0
    ) {
      const assistant = msgData.data.assistantMessage;
      const isRaftMentioned = assistant.content.toLowerCase().includes("raft") || assistant.content.toLowerCase().includes("leader");
      const hasSources = assistant.sources.length > 0 && assistant.sources[0].documentName;
      record("PHASE 2", "Grounded AI Tutor Answer with Citations & pgvector Retrieval", isRaftMentioned && hasSources, undefined, {
        sourcesCount: assistant.sources.length,
        firstSource: assistant.sources[0]?.documentName,
        score: assistant.sources[0]?.score,
      });
    } else {
      record("PHASE 2", "Grounded AI Tutor Answer with Citations & pgvector Retrieval", false, `Status ${msgRes.status}: ${JSON.stringify(msgData)}`);
    }
  } catch (err: any) {
    record("PHASE 2", "Grounded AI Tutor Answer with Citations & pgvector Retrieval", false, err.message);
  }

  // Test 2.3: Follow-up question in the same conversation
  try {
    const followUpText = "What timeout duration is used for randomized timeouts?";
    const msgRes = await fetch(`${BASE_URL}/ai/conversations/${testConversationId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${demoStudentToken}`,
      },
      body: JSON.stringify({ content: followUpText }),
    });
    const msgData = await msgRes.json();
    if (msgRes.status === 201 && msgData.success && msgData.data?.assistantMessage?.content) {
      record("PHASE 2", "AI Tutor Follow-Up Question in Thread", true);
    } else {
      record("PHASE 2", "AI Tutor Follow-Up Question in Thread", false, `Status ${msgRes.status}`);
    }
  } catch (err: any) {
    record("PHASE 2", "AI Tutor Follow-Up Question in Thread", false, err.message);
  }

  // Test 2.4: Out-of-syllabus irrelevant question (anti-hallucination check)
  try {
    const cakeConvoRes = await fetch(`${BASE_URL}/ai/conversations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${demoStudentToken}`,
      },
      body: JSON.stringify({
        courseId: cs401CourseId,
        title: "Irrelevant Query Test",
      }),
    });
    const cakeConvoData = await cakeConvoRes.json();
    const cakeMsgRes = await fetch(`${BASE_URL}/ai/conversations/${cakeConvoData.data.id}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${demoStudentToken}`,
      },
      body: JSON.stringify({ content: "What is the recipe for chocolate cake?" }),
    });
    const cakeMsgData = await cakeMsgRes.json();
    const content = cakeMsgData.data?.assistantMessage?.content?.toLowerCase() || "";
    const isAntiHallucinating = content.includes("couldn't find") || content.includes("not found") || content.includes("syllabus") || content.includes("course");
    record("PHASE 2", "Anti-Hallucination on Irrelevant Query ('chocolate cake')", isAntiHallucinating);
  } catch (err: any) {
    record("PHASE 2", "Anti-Hallucination on Irrelevant Query ('chocolate cake')", false, err.message);
  }

  // ---------------------------------------------------------
  // PHASE 4: DATABASE & PRISMA INTEGRITY
  // ---------------------------------------------------------
  console.log("\n--- PHASE 4: DATABASE & PRISMA INTEGRITY ---");
  try {
    const userCount = await prisma.user.count();
    const courseCount = await prisma.course.count();
    const materialCount = await prisma.material.count();
    const chunkCount = await prisma.documentChunk.count();
    const quizCount = await prisma.quiz.count();
    const questionCount = await prisma.question.count();
    const assignmentCount = await prisma.assignment.count();
    const enrollmentCount = await prisma.enrollment.count();

    const passed = userCount > 0 && courseCount > 0 && materialCount > 0 && chunkCount > 0 && quizCount > 0;
    record("PHASE 4", "Database Tables & Relational Integrity", passed, undefined, {
      users: userCount,
      courses: courseCount,
      materials: materialCount,
      chunks: chunkCount,
      quizzes: quizCount,
      questions: questionCount,
      assignments: assignmentCount,
      enrollments: enrollmentCount,
    });
  } catch (err: any) {
    record("PHASE 4", "Database Tables & Relational Integrity", false, err.message);
  }

  // ---------------------------------------------------------
  // PHASE 5: COURSE & ENROLLMENT FLOW
  // ---------------------------------------------------------
  console.log("\n--- PHASE 5: COURSE & ENROLLMENT FLOW ---");

  // Test 5.1: List all courses
  try {
    const cRes = await fetch(`${BASE_URL}/courses`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const cData = await cRes.json();
    if (cRes.status === 200 && Array.isArray(cData.data) && cData.data.length > 0) {
      record("PHASE 5", "List All Academic Courses (GET /courses)", true, undefined, { count: cData.data.length });
    } else {
      record("PHASE 5", "List All Academic Courses (GET /courses)", false, `Status ${cRes.status}`);
    }
  } catch (err: any) {
    record("PHASE 5", "List All Academic Courses (GET /courses)", false, err.message);
  }

  // Test 5.2: Student enrolls in CS-401
  try {
    const enrollRes = await fetch(`${BASE_URL}/courses/${cs401CourseId}/enroll`, {
      method: "POST",
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const enrollData = await enrollRes.json();
    if (enrollRes.status === 201 && enrollData.success) {
      record("PHASE 5", "Student Course Enrollment (POST /courses/:id/enroll)", true);
    } else {
      record("PHASE 5", "Student Course Enrollment (POST /courses/:id/enroll)", false, `Status ${enrollRes.status}: ${JSON.stringify(enrollData)}`);
    }
  } catch (err: any) {
    record("PHASE 5", "Student Course Enrollment (POST /courses/:id/enroll)", false, err.message);
  }

  // Test 5.3: Duplicate enrollment returns 409
  try {
    const dupEnrollRes = await fetch(`${BASE_URL}/courses/${cs401CourseId}/enroll`, {
      method: "POST",
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    if (dupEnrollRes.status === 409) {
      record("PHASE 5", "Reject Duplicate Enrollment (409 Conflict)", true);
    } else {
      record("PHASE 5", "Reject Duplicate Enrollment (409 Conflict)", false, `Expected 409, got ${dupEnrollRes.status}`);
    }
  } catch (err: any) {
    record("PHASE 5", "Reject Duplicate Enrollment (409 Conflict)", false, err.message);
  }

  // Test 5.4: List student's enrolled courses
  try {
    const myCoursesRes = await fetch(`${BASE_URL}/students/${studentUserId}/courses`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const myCoursesData = await myCoursesRes.json();
    if (myCoursesRes.status === 200 && Array.isArray(myCoursesData.data) && myCoursesData.data.length === 1) {
      record("PHASE 5", "List Student Enrolled Courses (GET /students/:id/courses)", true);
    } else {
      record("PHASE 5", "List Student Enrolled Courses (GET /students/:id/courses)", false, `Status ${myCoursesRes.status}`);
    }
  } catch (err: any) {
    record("PHASE 5", "List Student Enrolled Courses (GET /students/:id/courses)", false, err.message);
  }

  // ---------------------------------------------------------
  // PHASE 6: MATERIALS / PDF VIEWER & PROGRESS
  // ---------------------------------------------------------
  console.log("\n--- PHASE 6: MATERIALS / PDF STREAMING & PROGRESS ---");

  let testMaterialId = "";
  try {
    const matsRes = await fetch(`${BASE_URL}/courses/${cs401CourseId}/materials`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const matsData = await matsRes.json();
    if (matsRes.status === 200 && Array.isArray(matsData.data) && matsData.data.length > 0) {
      testMaterialId = matsData.data[0].id;
      record("PHASE 6", "List Course Materials (GET /courses/:id/materials)", true, undefined, { count: matsData.data.length });
    } else {
      record("PHASE 6", "List Course Materials (GET /courses/:id/materials)", false, `Status ${matsRes.status}`);
    }
  } catch (err: any) {
    record("PHASE 6", "List Course Materials (GET /courses/:id/materials)", false, err.message);
  }

  // Test 6.2: PDF Binary Stream for Enrolled Student
  try {
    const streamRes = await fetch(`${BASE_URL}/materials/${testMaterialId}/file`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const contentType = streamRes.headers.get("content-type");
    if (streamRes.status === 200 && contentType?.includes("application/pdf")) {
      const buffer = await streamRes.arrayBuffer();
      record("PHASE 6", "Stream Protected PDF Binary (GET /materials/:id/file)", buffer.byteLength > 1000, undefined, { bytes: buffer.byteLength });
    } else {
      record("PHASE 6", "Stream Protected PDF Binary (GET /materials/:id/file)", false, `Status ${streamRes.status}, Content-Type: ${contentType}`);
    }
  } catch (err: any) {
    record("PHASE 6", "Stream Protected PDF Binary (GET /materials/:id/file)", false, err.message);
  }

  // Test 6.3: Save & Retrieve Reading Progress
  try {
    const putProgRes = await fetch(`${BASE_URL}/materials/${testMaterialId}/progress`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        currentPage: 3,
        totalPages: 5,
        completed: false,
      }),
    });

    const getProgRes = await fetch(`${BASE_URL}/materials/${testMaterialId}/progress`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const getProgData = await getProgRes.json();

    if (
      putProgRes.status === 200 &&
      getProgRes.status === 200 &&
      getProgData.data?.currentPage === 3 &&
      getProgData.data?.progressPercent === 60
    ) {
      record("PHASE 6", "Save and Restore Reading Progress (PUT & GET /materials/:id/progress)", true, undefined, {
        page: getProgData.data.currentPage,
        percent: getProgData.data.progressPercent,
      });
    } else {
      record("PHASE 6", "Save and Restore Reading Progress", false, `Put status ${putProgRes.status}, Get status ${getProgRes.status}`);
    }
  } catch (err: any) {
    record("PHASE 6", "Save and Restore Reading Progress", false, err.message);
  }

  // ---------------------------------------------------------
  // PHASE 7: QUIZZES
  // ---------------------------------------------------------
  console.log("\n--- PHASE 7: QUIZZES ---");

  let testQuizId = "";
  try {
    const qListRes = await fetch(`${BASE_URL}/courses/${cs401CourseId}/quizzes`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const qListData = await qListRes.json();
    if (qListRes.status === 200 && Array.isArray(qListData.data) && qListData.data.length > 0) {
      testQuizId = qListData.data[0].id;
      record("PHASE 7", "List Course Quizzes (GET /courses/:id/quizzes)", true, undefined, { count: qListData.data.length });
    } else {
      record("PHASE 7", "List Course Quizzes (GET /courses/:id/quizzes)", false, `Status ${qListRes.status}`);
    }
  } catch (err: any) {
    record("PHASE 7", "List Course Quizzes (GET /courses/:id/quizzes)", false, err.message);
  }

  // Test 7.2: Get Quiz with Questions (Student should NOT see correctOptionIndex or explanation)
  let quizQuestions: any[] = [];
  try {
    const qRes = await fetch(`${BASE_URL}/quizzes/${testQuizId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const qData = await qRes.json();
    if (qRes.status === 200 && qData.success && Array.isArray(qData.data?.questions)) {
      quizQuestions = qData.data.questions;
      const leaksAnswers = quizQuestions.some((q) => q.correctOptionIndex !== undefined || q.explanation !== undefined);
      record("PHASE 7", "Get Quiz Questions without Leaking Answers to Student", !leaksAnswers, leaksAnswers ? "Answers leaked in payload!" : undefined, {
        questionCount: quizQuestions.length,
      });
    } else {
      record("PHASE 7", "Get Quiz Questions without Leaking Answers to Student", false, `Status ${qRes.status}`);
    }
  } catch (err: any) {
    record("PHASE 7", "Get Quiz Questions without Leaking Answers to Student", false, err.message);
  }

  // Test 7.3: Submit Quiz Attempt & Verify Scoring
  try {
    const answersPayload = quizQuestions.map((q, idx) => ({
      questionId: q.id,
      selectedOptionIndex: idx % 2 === 0 ? 0 : 1,
    }));

    const attemptRes = await fetch(`${BASE_URL}/quizzes/${testQuizId}/attempts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        timeSpentSeconds: 180,
        answers: answersPayload,
      }),
    });
    const attemptData = await attemptRes.json();
    if (attemptRes.status === 201 && attemptData.success && attemptData.data?.id && typeof attemptData.data.score === "number") {
      record("PHASE 7", "Submit Quiz Attempt & Server-Side Scoring (POST /quizzes/:id/attempts)", true, undefined, {
        score: attemptData.data.score,
        percentage: attemptData.data.percentage,
        weakTopics: attemptData.data.weakTopicsIdentified,
      });
    } else {
      record("PHASE 7", "Submit Quiz Attempt & Server-Side Scoring", false, `Status ${attemptRes.status}: ${JSON.stringify(attemptData)}`);
    }
  } catch (err: any) {
    record("PHASE 7", "Submit Quiz Attempt & Server-Side Scoring", false, err.message);
  }

  // ---------------------------------------------------------
  // PHASE 8: ASSIGNMENTS
  // ---------------------------------------------------------
  console.log("\n--- PHASE 8: ASSIGNMENTS ---");

  let testAssignmentId = "";
  try {
    const aListRes = await fetch(`${BASE_URL}/courses/${cs401CourseId}/assignments`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const aListData = await aListRes.json();
    if (aListRes.status === 200 && Array.isArray(aListData.data) && aListData.data.length > 0) {
      testAssignmentId = aListData.data[0].id;
      record("PHASE 8", "List Course Assignments (GET /courses/:id/assignments)", true, undefined, { count: aListData.data.length });
    } else {
      record("PHASE 8", "List Course Assignments (GET /courses/:id/assignments)", false, `Status ${aListRes.status}`);
    }
  } catch (err: any) {
    record("PHASE 8", "List Course Assignments (GET /courses/:id/assignments)", false, err.message);
  }

  // Test 8.2: Submit Assignment Solution
  let submissionId = "";
  try {
    const subRes = await fetch(`${BASE_URL}/assignments/${testAssignmentId}/submissions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        content: "Distributed consensus implementation utilizing Raft log replication.",
        fileUrl: `/uploads/submissions/test_student_sol.pdf`,
      }),
    });
    const subData = await subRes.json();
    if (subRes.status === 201 && subData.success && subData.data?.id) {
      submissionId = subData.data.id;
      record("PHASE 8", "Submit Assignment Solution (POST /assignments/:id/submissions)", true);
    } else {
      record("PHASE 8", "Submit Assignment Solution", false, `Status ${subRes.status}`);
    }
  } catch (err: any) {
    record("PHASE 8", "Submit Assignment Solution", false, err.message);
  }

  // Test 8.3: Faculty Grades Submission
  try {
    const gradeRes = await fetch(`${BASE_URL}/submissions/${submissionId}/grade`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${facultyToken}`,
      },
      body: JSON.stringify({
        score: 95,
        feedback: "Excellent analysis of leader election timeouts and quorum safety invariants.",
      }),
    });
    const gradeData = await gradeRes.json();
    if (gradeRes.status === 200 && gradeData.success && gradeData.data?.score === 95) {
      record("PHASE 8", "Faculty Grades Student Submission (PUT /submissions/:id/grade)", true);
    } else {
      record("PHASE 8", "Faculty Grades Student Submission", false, `Status ${gradeRes.status}: ${JSON.stringify(gradeData)}`);
    }
  } catch (err: any) {
    record("PHASE 8", "Faculty Grades Student Submission", false, err.message);
  }

  // ---------------------------------------------------------
  // PHASE 9: PERFORMANCE & ANALYTICS
  // ---------------------------------------------------------
  console.log("\n--- PHASE 9: PERFORMANCE & ANALYTICS ---");

  // Test 9.1: Student gets own performance
  try {
    const perfRes = await fetch(`${BASE_URL}/students/${studentUserId}/performance`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const perfData = await perfRes.json();
    if (perfRes.status === 200 && perfData.success && perfData.data?.stats) {
      record("PHASE 9", "Student Fetches Own Performance (GET /students/:id/performance)", true, undefined, perfData.data.stats);
    } else {
      record("PHASE 9", "Student Fetches Own Performance", false, `Status ${perfRes.status}`);
    }
  } catch (err: any) {
    record("PHASE 9", "Student Fetches Own Performance", false, err.message);
  }

  // Test 9.2: Student gets weak topics
  try {
    const weakRes = await fetch(`${BASE_URL}/students/${studentUserId}/weak-topics`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const weakData = await weakRes.json();
    if (weakRes.status === 200 && Array.isArray(weakData.data)) {
      record("PHASE 9", "Student Fetches Diagnostic Weak Topics (GET /students/:id/weak-topics)", true, undefined, { count: weakData.data.length });
    } else {
      record("PHASE 9", "Student Fetches Diagnostic Weak Topics", false, `Status ${weakRes.status}`);
    }
  } catch (err: any) {
    record("PHASE 9", "Student Fetches Diagnostic Weak Topics", false, err.message);
  }

  // ---------------------------------------------------------
  // PHASE 10: FACULTY PORTAL ENDPOINTS
  // ---------------------------------------------------------
  console.log("\n--- PHASE 10: FACULTY PORTAL ENDPOINTS ---");

  // Test 10.1: Faculty Courses
  try {
    const facCoursesRes = await fetch(`${BASE_URL}/faculty/${facultyId}/courses`, {
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    const facCoursesData = await facCoursesRes.json();
    if (facCoursesRes.status === 200 && Array.isArray(facCoursesData.data)) {
      record("PHASE 10", "Faculty Courses List (GET /faculty/:id/courses)", true, undefined, { count: facCoursesData.data.length });
    } else {
      record("PHASE 10", "Faculty Courses List", false, `Status ${facCoursesRes.status}`);
    }
  } catch (err: any) {
    record("PHASE 10", "Faculty Courses List", false, err.message);
  }

  // Test 10.2: Faculty Analytics
  try {
    const facAnalRes = await fetch(`${BASE_URL}/analytics/faculty/${facultyId}`, {
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    const facAnalData = await facAnalRes.json();
    if (facAnalRes.status === 200 && facAnalData.success && facAnalData.data?.overview) {
      record("PHASE 10", "Faculty Cohort Analytics (GET /analytics/faculty/:id)", true, undefined, facAnalData.data.overview);
    } else {
      record("PHASE 10", "Faculty Cohort Analytics", false, `Status ${facAnalRes.status}`);
    }
  } catch (err: any) {
    record("PHASE 10", "Faculty Cohort Analytics", false, err.message);
  }

  // Test 10.3: At-Risk Students
  try {
    const atRiskRes = await fetch(`${BASE_URL}/analytics/at-risk`, {
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    const atRiskData = await atRiskRes.json();
    if (atRiskRes.status === 200 && Array.isArray(atRiskData.data)) {
      record("PHASE 10", "At-Risk Student Diagnostic Detection (GET /analytics/at-risk)", true, undefined, { count: atRiskData.data.length });
    } else {
      record("PHASE 10", "At-Risk Student Diagnostic Detection", false, `Status ${atRiskRes.status}`);
    }
  } catch (err: any) {
    record("PHASE 10", "At-Risk Student Diagnostic Detection", false, err.message);
  }

  // ---------------------------------------------------------
  // PHASE 11: ADMIN CONSOLE ENDPOINTS
  // ---------------------------------------------------------
  console.log("\n--- PHASE 11: ADMIN CONSOLE ENDPOINTS ---");

  // Test 11.1: Admin list users
  try {
    const usersRes = await fetch(`${BASE_URL}/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const usersData = await usersRes.json();
    if (usersRes.status === 200 && Array.isArray(usersData.data)) {
      record("PHASE 11", "Admin List Users (GET /users)", true, undefined, { count: usersData.data.length });
    } else {
      record("PHASE 11", "Admin List Users", false, `Status ${usersRes.status}`);
    }
  } catch (err: any) {
    record("PHASE 11", "Admin List Users", false, err.message);
  }

  // Test 11.2: Non-Admin blocked from /users
  try {
    const blockedRes = await fetch(`${BASE_URL}/users`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    if (blockedRes.status === 403) {
      record("PHASE 11", "Non-Admin Forbidden from /users (403 Forbidden)", true);
    } else {
      record("PHASE 11", "Non-Admin Forbidden from /users", false, `Expected 403, got ${blockedRes.status}`);
    }
  } catch (err: any) {
    record("PHASE 11", "Non-Admin Forbidden from /users", false, err.message);
  }

  // ---------------------------------------------------------
  // PHASE 12: SECURITY & IDOR ISOLATION MATRIX
  // ---------------------------------------------------------
  console.log("\n--- PHASE 12: SECURITY & IDOR ISOLATION MATRIX ---");

  // Test 12.1: Student accessing another student's performance (IDOR)
  try {
    const idorRes = await fetch(`${BASE_URL}/students/${demoStudentId}/performance`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    if (idorRes.status === 403) {
      record("PHASE 12", "IDOR Protection: Student Blocked from Other Student's Performance (403)", true);
    } else {
      record("PHASE 12", "IDOR Protection: Student Blocked from Other Student's Performance", false, `Expected 403, got ${idorRes.status}`);
    }
  } catch (err: any) {
    record("PHASE 12", "IDOR Protection: Student Blocked from Other Student's Performance", false, err.message);
  }

  // Test 12.2: Student accessing another student's weak topics (IDOR)
  try {
    const idorWeakRes = await fetch(`${BASE_URL}/students/${demoStudentId}/weak-topics`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    if (idorWeakRes.status === 403) {
      record("PHASE 12", "IDOR Protection: Student Blocked from Other Student's Weak Topics (403)", true);
    } else {
      record("PHASE 12", "IDOR Protection: Student Blocked from Other Student's Weak Topics", false, `Expected 403, got ${idorWeakRes.status}`);
    }
  } catch (err: any) {
    record("PHASE 12", "IDOR Protection: Student Blocked from Other Student's Weak Topics", false, err.message);
  }

  // Test 12.3: Unauthenticated request rejected (401)
  try {
    const unauthRes = await fetch(`${BASE_URL}/courses`);
    if (unauthRes.status === 401) {
      record("PHASE 12", "Unauthenticated Request Rejected (401 Unauthorized)", true);
    } else {
      record("PHASE 12", "Unauthenticated Request Rejected (401 Unauthorized)", false, `Expected 401, got ${unauthRes.status}`);
    }
  } catch (err: any) {
    record("PHASE 12", "Unauthenticated Request Rejected (401 Unauthorized)", false, err.message);
  }

  // ---------------------------------------------------------
  // FINAL SUMMARY
  // ---------------------------------------------------------
  console.log("\n==================================================================");
  console.log("AUDIT SUMMARY");
  console.log("==================================================================");
  const total = auditResults.length;
  const passed = auditResults.filter((r) => r.passed).length;
  const failed = auditResults.filter((r) => !r.passed).length;

  console.log(`TOTAL CHECKS: ${total}`);
  console.log(`PASSED:       ${passed}`);
  console.log(`FAILED:       ${failed}`);
  console.log("==================================================================");

  await prisma.$disconnect();
}

runFullAudit().catch((e) => {
  console.error("Audit Suite Encountered Error:", e);
  process.exit(1);
});
