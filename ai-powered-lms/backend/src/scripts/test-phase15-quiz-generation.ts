import "dotenv/config";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";
import { getJwtSecret } from "../middleware/auth.middleware.js";
import {
  generateQuizQuestions,
  validateGeneratedQuestions,
  QuizResponseSchema,
} from "../services/ai/quiz-generator.service.js";
import { getQuizById, submitQuizAttempt } from "../services/quiz.service.js";
import { providerRegistry } from "../services/ai/providers/provider.registry.js";
import { LLMProvider, LLMGenerationResult, LLMGenerationOptions } from "../services/ai/providers/llm-provider.interface.js";
import { embeddingService } from "../services/ai/embedding.service.js";

interface TestReport {
  name: string;
  status: "PASS" | "FAIL" | "SKIP";
  expected: string;
  actual: string;
  notes?: string;
}

const reports: TestReport[] = [];

function recordTest(report: TestReport) {
  reports.push(report);
  const icon = report.status === "PASS" ? "✅ PASS" : report.status === "SKIP" ? "⚠️ SKIP" : "❌ FAIL";
  console.log(`[${icon}] ${report.name}`);
  console.log(`       Expected: ${report.expected}`);
  console.log(`       Actual:   ${report.actual}`);
  if (report.notes) {
    console.log(`       Notes:    ${report.notes}`);
  }
  console.log("");
}

/**
 * Mock LLM Provider for deterministic, quota-free unit testing of generation, schema, and lifecycle.
 */
class MockQuizLLMProvider implements LLMProvider {
  public readonly providerId = "mock-quiz-llm";
  public readonly modelName = "mock-quiz-model";
  private customResponseText: string | null = null;

  public setNextResponse(jsonText: string | null) {
    this.customResponseText = jsonText;
  }

  public async generateCompletion(
    prompt: string,
    options?: LLMGenerationOptions
  ): Promise<LLMGenerationResult> {
    if (this.customResponseText) {
      const text = this.customResponseText;
      this.customResponseText = null;
      return {
        text,
        model: this.modelName,
        durationMs: 45,
      };
    }

    // Default valid mock response conforming to QuizResponseSchema
    const isGroundedPrompt = prompt.includes("[GROUNDED COURSE SYLLABUS MATERIALS]");
    const defaultData = {
      quizTitle: "Consensus Algorithms Assessment",
      questions: [
        {
          question: "What is the primary mechanism Raft uses to prevent split-vote deadlocks?",
          options: [
            "Randomized election timeouts across candidate nodes",
            "Hardware clock synchronization with atomic GPS clocks",
            "Centralized arbiter dispatching token locks",
            "Immediate rollback of uncommitted state machines",
          ],
          correctOptionIndex: 0,
          explanation: "Raft staggers candidate terms using randomized timeouts to ensure one server gathers votes first.",
          bloomsLevel: "Understand",
          difficulty: "Medium",
          topic: "Raft Consensus",
          sourceCitation: isGroundedPrompt
            ? "Distributed_Systems_Lec4.pdf (Unit: Unit 2, Page: 14)"
            : "",
        },
        {
          question: "In standard fault-tolerant state machine replication, what constitutes a valid quorum?",
          options: [
            "A strict majority (floor(N/2) + 1) of cluster nodes",
            "Any single node with the highest CPU clock frequency",
            "100% of all configured servers at all times",
            "A minority of non-faulty nodes with odd node IDs",
          ],
          correctOptionIndex: 0,
          explanation: "Quorums require a strict majority to ensure any two quorums overlap by at least one node.",
          bloomsLevel: "Analyze",
          difficulty: "Medium",
          topic: "Quorum Mechanics",
          sourceCitation: isGroundedPrompt
            ? "Distributed_Systems_Lec4.pdf (Unit: Unit 2, Page: 19)"
            : "",
        },
      ],
    };

    return {
      text: JSON.stringify(defaultData),
      model: this.modelName,
      durationMs: 65,
    };
  }
}

export async function runPhase15Tests() {
  console.log("================================================================================");
  console.log("AURA LMS: PHASE 15 SERVER-SIDE LLM QUIZ API COMPREHENSIVE VERIFICATION SUITE");
  console.log("================================================================================\n");

  const mockProvider = new MockQuizLLMProvider();
  providerRegistry.registerProvider(mockProvider);
  providerRegistry.setDefaultProviderId("mock-quiz-llm");

  const originalEmbedText = embeddingService.embedText.bind(embeddingService);
  embeddingService.embedText = async () => new Array(3072).fill(0.01);

  // Setup test entities
  let testFaculty1: any = null;
  let testFaculty2: any = null;
  let testStudent: any = null;
  let testAdmin: any = null;
  let testCourseWithChunks: any = null;
  let testCourseWithoutChunks: any = null;
  let createdQuizIds: string[] = [];

  try {
    // 0. Test Entity Setup
    const timestamp = Date.now();
    testFaculty1 = await prisma.user.create({
      data: {
        email: `p15_fac1_${timestamp}@university.edu`,
        passwordHash: "test_hash",
        name: "Dr. Phase 15 Instructor",
        role: "FACULTY",
        department: "Computer Science",
      },
    });

    testFaculty2 = await prisma.user.create({
      data: {
        email: `p15_fac2_${timestamp}@university.edu`,
        passwordHash: "test_hash",
        name: "Dr. Unrelated Faculty",
        role: "FACULTY",
        department: "Mechanical Engineering",
      },
    });

    testStudent = await prisma.user.create({
      data: {
        email: `p15_stud_${timestamp}@university.edu`,
        passwordHash: "test_hash",
        name: "Test Student Phase 15",
        role: "STUDENT",
        department: "Computer Science",
      },
    });

    testAdmin = await prisma.user.create({
      data: {
        email: `p15_admin_${timestamp}@university.edu`,
        passwordHash: "test_hash",
        name: "System Admin Phase 15",
        role: "ADMIN",
        department: "Administration",
      },
    });

    // Course 1: Will have document chunks
    testCourseWithChunks = await prisma.course.create({
      data: {
        code: `CS-P15-1-${timestamp % 10000}`,
        title: "Distributed Consensus & Fault Tolerance",
        description: "Advanced distributed systems course",
        department: "Computer Science",
        facultyId: testFaculty1.id,
      },
    });

    // Course 2: Empty, zero materials/chunks
    testCourseWithoutChunks = await prisma.course.create({
      data: {
        code: `CS-P15-2-${timestamp % 10000}`,
        title: "Theoretical Computer Science",
        description: "Empty test course without materials",
        department: "Computer Science",
        facultyId: testFaculty1.id,
      },
    });

    // Seed a material and DocumentChunk for Course 1
    const testMaterial = await prisma.material.create({
      data: {
        courseId: testCourseWithChunks.id,
        title: "Distributed_Systems_Lec4.pdf",
        unit: "Unit 2: Consensus",
        fileUrl: "/uploads/materials/test-p15.pdf",
        fileType: "application/pdf",
        fileSize: "1.2 MB",
      },
    });

    // Insert dummy pgvector chunk for Course 1
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO "DocumentChunk" (id, "materialId", "chunkIndex", "pageNumber", content, "tokenCount", "characterCount", embedding)
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, array_fill(0.01::float4, ARRAY[3072])::vector
      );
      `,
      `chunk-p15-${timestamp}`,
      testMaterial.id,
      0, // chunkIndex
      14, // pageNumber
      "The Raft consensus algorithm utilizes randomized election timeouts to ensure split votes are quickly resolved among candidates.",
      25, // tokenCount
      126 // characterCount
    );

    // Enroll student in Course 1
    await prisma.enrollment.create({
      data: {
        studentId: testStudent.id,
        courseId: testCourseWithChunks.id,
      },
    });

    // ============================================================================
    // TEST 1: Mandatory Post-Generation Server-Side Validation Layer
    // ============================================================================
    console.log("--- Executing Test 1: Mandatory Server-Side Validation Layer ---");

    // Case 1A: Rejection on duplicate options
    let duplicateRejected = false;
    try {
      validateGeneratedQuestions(
        [
          {
            question: "Sample Question?",
            options: ["Option A", "Option A", "Option B", "Option C"], // duplicate!
            correctOptionIndex: 0,
            explanation: "Valid explanation",
            bloomsLevel: "Understand",
            difficulty: "Medium",
            topic: "Sample Topic",
            sourceCitation: "Doc.pdf (p1)",
          },
        ],
        true
      );
    } catch (err: any) {
      if (err.statusCode === 422 && err.message.includes("all 4 options must be distinct")) {
        duplicateRejected = true;
      }
    }
    recordTest({
      name: "1A. Reject question with duplicate answer choices",
      expected: "HTTP 422 with 'all 4 options must be distinct'",
      actual: duplicateRejected ? "HTTP 422 (Duplicate options caught)" : "Failed to reject duplicates",
      status: duplicateRejected ? "PASS" : "FAIL",
    });

    // Case 1B: Rejection on options count != 4
    let countRejected = false;
    try {
      validateGeneratedQuestions(
        [
          {
            question: "Sample Question?",
            options: ["Option 1", "Option 2", "Option 3"], // Only 3!
            correctOptionIndex: 0,
            explanation: "Valid explanation",
            bloomsLevel: "Understand",
            difficulty: "Medium",
            topic: "Sample Topic",
            sourceCitation: "Doc.pdf (p1)",
          },
        ],
        true
      );
    } catch (err: any) {
      if (err.statusCode === 422 && err.message.includes("must provide exactly 4 options")) {
        countRejected = true;
      }
    }
    recordTest({
      name: "1B. Reject question with fewer or more than 4 options",
      expected: "HTTP 422 with 'must provide exactly 4 options'",
      actual: countRejected ? "HTTP 422 (3 options rejected)" : "Failed to reject invalid options count",
      status: countRejected ? "PASS" : "FAIL",
    });

    // Case 1C: Rejection on out-of-bounds correctOptionIndex
    let indexRejected = false;
    try {
      validateGeneratedQuestions(
        [
          {
            question: "Sample Question?",
            options: ["Opt 1", "Opt 2", "Opt 3", "Opt 4"],
            correctOptionIndex: 4, // out of range 0..3!
            explanation: "Valid explanation",
            bloomsLevel: "Understand",
            difficulty: "Medium",
            topic: "Sample Topic",
            sourceCitation: "Doc.pdf (p1)",
          },
        ],
        true
      );
    } catch (err: any) {
      if (err.statusCode === 422 && err.message.includes("correctOptionIndex must be an integer between 0 and 3")) {
        indexRejected = true;
      }
    }
    recordTest({
      name: "1C. Reject question with invalid correctOptionIndex (out of bounds)",
      expected: "HTTP 422 with 'correctOptionIndex must be an integer between 0 and 3'",
      actual: indexRejected ? "HTTP 422 (Index 4 rejected)" : "Failed to reject invalid index",
      status: indexRejected ? "PASS" : "FAIL",
    });

    // Case 1D: Rejection on invalid BloomsLevel
    let bloomsRejected = false;
    try {
      validateGeneratedQuestions(
        [
          {
            question: "Sample Question?",
            options: ["Opt 1", "Opt 2", "Opt 3", "Opt 4"],
            correctOptionIndex: 1,
            explanation: "Valid explanation",
            bloomsLevel: "InvalidLevel", // Invalid!
            difficulty: "Medium",
            topic: "Sample Topic",
            sourceCitation: "Doc.pdf (p1)",
          },
        ],
        true
      );
    } catch (err: any) {
      if (err.statusCode === 422 && err.message.includes("bloomsLevel 'InvalidLevel' is invalid")) {
        bloomsRejected = true;
      }
    }
    recordTest({
      name: "1D. Reject question with invalid BloomsLevel enum",
      expected: "HTTP 422 with 'bloomsLevel 'InvalidLevel' is invalid'",
      actual: bloomsRejected ? "HTTP 422 (Invalid BloomsLevel rejected)" : "Failed to reject invalid bloomsLevel",
      status: bloomsRejected ? "PASS" : "FAIL",
    });

    // Case 1E: Rejection on grounded question missing sourceCitation
    let citationRejected = false;
    try {
      validateGeneratedQuestions(
        [
          {
            question: "Sample Question?",
            options: ["Opt 1", "Opt 2", "Opt 3", "Opt 4"],
            correctOptionIndex: 1,
            explanation: "Valid explanation",
            bloomsLevel: "Analyze",
            difficulty: "Medium",
            topic: "Sample Topic",
            sourceCitation: "", // Grounded but empty citation!
          },
        ],
        true // isGrounded = true
      );
    } catch (err: any) {
      if (err.statusCode === 422 && err.message.includes("grounded questions must provide a non-empty sourceCitation")) {
        citationRejected = true;
      }
    }
    recordTest({
      name: "1E. Reject grounded question missing sourceCitation",
      expected: "HTTP 422 with 'grounded questions must provide a non-empty sourceCitation'",
      actual: citationRejected ? "HTTP 422 (Empty citation rejected in grounded mode)" : "Failed to reject empty citation",
      status: citationRejected ? "PASS" : "FAIL",
    });

    // Case 1F: Acceptance of ungrounded question with empty sourceCitation
    let ungroundedAccepted = false;
    try {
      const res = validateGeneratedQuestions(
        [
          {
            question: "General Curriculum Question?",
            options: ["Opt 1", "Opt 2", "Opt 3", "Opt 4"],
            correctOptionIndex: 2,
            explanation: "Valid pedagogical explanation",
            bloomsLevel: "Apply",
            difficulty: "Hard",
            topic: "Algorithms",
            sourceCitation: "", // Empty citation permitted when isGrounded = false
          },
        ],
        false // isGrounded = false
      );
      ungroundedAccepted = res.length === 1 && res[0].sourceCitation === "";
    } catch (err: any) {
      ungroundedAccepted = false;
    }
    recordTest({
      name: "1F. Accept ungrounded fallback question with empty sourceCitation",
      expected: "Validation succeeds with sourceCitation: ''",
      actual: ungroundedAccepted ? "Validation passed smoothly" : "Unexpected validation failure",
      status: ungroundedAccepted ? "PASS" : "FAIL",
    });

    // ============================================================================
    // TEST 2: Course Access & RBAC Authorization Checks
    // ============================================================================
    console.log("--- Executing Test 2: Course Access & RBAC Authorization ---");

    // Case 2A: STUDENT rejected with 403
    let studentBlocked = false;
    try {
      await generateQuizQuestions(
        { courseId: testCourseWithChunks.id, topic: "Raft Consensus" },
        testStudent.id,
        "STUDENT"
      );
    } catch (err: any) {
      if (err.statusCode === 403) studentBlocked = true;
    }
    recordTest({
      name: "2A. Student role rejected from generating quiz",
      expected: "HTTP 403 Forbidden",
      actual: studentBlocked ? "HTTP 403 Forbidden" : "Allowed student access",
      status: studentBlocked ? "PASS" : "FAIL",
    });

    // Case 2B: Faculty on unowned course rejected with 403
    let crossFacultyBlocked = false;
    try {
      await generateQuizQuestions(
        { courseId: testCourseWithChunks.id, topic: "Raft Consensus" },
        testFaculty2.id, // Faculty 2 does not teach Course 1!
        "FACULTY"
      );
    } catch (err: any) {
      if (err.statusCode === 403) crossFacultyBlocked = true;
    }
    recordTest({
      name: "2B. Faculty rejected from generating quiz for other faculty's course",
      expected: "HTTP 403 Forbidden",
      actual: crossFacultyBlocked ? "HTTP 403 Forbidden" : "Allowed cross-faculty access",
      status: crossFacultyBlocked ? "PASS" : "FAIL",
    });

    // Case 2C: Assigned faculty authorized
    let assignedFacultyAllowed = false;
    try {
      const res = await generateQuizQuestions(
        { courseId: testCourseWithChunks.id, topic: "Raft Consensus", saveImmediately: false },
        testFaculty1.id,
        "FACULTY"
      );
      assignedFacultyAllowed = Boolean(res && res.questions.length > 0);
    } catch (err: any) {
      assignedFacultyAllowed = false;
    }
    recordTest({
      name: "2C. Assigned faculty authorized to generate quiz for their course",
      expected: "Success (questions returned)",
      actual: assignedFacultyAllowed ? "Authorized and generated successfully" : "Failed to authorize faculty",
      status: assignedFacultyAllowed ? "PASS" : "FAIL",
    });

    // Case 2D: Admin authorized on any course
    let adminAllowed = false;
    try {
      const res = await generateQuizQuestions(
        { courseId: testCourseWithChunks.id, topic: "Raft Consensus", saveImmediately: false },
        testAdmin.id,
        "ADMIN"
      );
      adminAllowed = Boolean(res && res.questions.length > 0);
    } catch (err: any) {
      adminAllowed = false;
    }
    recordTest({
      name: "2D. Administrator authorized to generate quiz on any course",
      expected: "Success (questions returned)",
      actual: adminAllowed ? "Authorized and generated successfully" : "Failed to authorize admin",
      status: adminAllowed ? "PASS" : "FAIL",
    });

    // ============================================================================
    // TEST 3: Input Validation Guards
    // ============================================================================
    console.log("--- Executing Test 3: Input Validation Guards ---");

    let missingCourseRejected = false;
    try {
      await generateQuizQuestions(
        { courseId: "", topic: "Raft Consensus" },
        testFaculty1.id,
        "FACULTY"
      );
    } catch (err: any) {
      if (err.statusCode === 400) missingCourseRejected = true;
    }
    recordTest({
      name: "3A. Missing courseId rejected with HTTP 400",
      expected: "HTTP 400 Bad Request",
      actual: missingCourseRejected ? "HTTP 400 Bad Request" : "Failed to reject missing courseId",
      status: missingCourseRejected ? "PASS" : "FAIL",
    });

    let missingTopicRejected = false;
    try {
      await generateQuizQuestions(
        { courseId: testCourseWithChunks.id, topic: "   " },
        testFaculty1.id,
        "FACULTY"
      );
    } catch (err: any) {
      if (err.statusCode === 400) missingTopicRejected = true;
    }
    recordTest({
      name: "3B. Missing/blank topic rejected with HTTP 400",
      expected: "HTTP 400 Bad Request",
      actual: missingTopicRejected ? "HTTP 400 Bad Request" : "Failed to reject blank topic",
      status: missingTopicRejected ? "PASS" : "FAIL",
    });

    let nonExistentCourseRejected = false;
    try {
      await generateQuizQuestions(
        { courseId: "00000000-0000-0000-0000-000000000000", topic: "Raft" },
        testFaculty1.id,
        "FACULTY"
      );
    } catch (err: any) {
      if (err.statusCode === 404) nonExistentCourseRejected = true;
    }
    recordTest({
      name: "3C. Non-existent courseId rejected with HTTP 404",
      expected: "HTTP 404 Not Found",
      actual: nonExistentCourseRejected ? "HTTP 404 Not Found" : "Failed to reject non-existent course",
      status: nonExistentCourseRejected ? "PASS" : "FAIL",
    });

    // ============================================================================
    // TEST 4: Preview Lifecycle Isolation (saveImmediately = false)
    // ============================================================================
    console.log("--- Executing Test 4: Preview Lifecycle Isolation ---");

    const quizzesBeforePreview = await prisma.quiz.count({
      where: { courseId: testCourseWithChunks.id },
    });
    const questionsBeforePreview = await prisma.question.count();

    const previewResult = await generateQuizQuestions(
      {
        courseId: testCourseWithChunks.id,
        topic: "Raft Consensus Algorithm",
        difficulty: "Medium",
        questionCount: 2,
        saveImmediately: false,
      },
      testFaculty1.id,
      "FACULTY"
    );

    const quizzesAfterPreview = await prisma.quiz.count({
      where: { courseId: testCourseWithChunks.id },
    });
    const questionsAfterPreview = await prisma.question.count();

    const isPreviewIsolated =
      previewResult.quiz === null &&
      quizzesBeforePreview === quizzesAfterPreview &&
      questionsBeforePreview === questionsAfterPreview &&
      previewResult.questions.length === 2;

    recordTest({
      name: "4. Preview mode generates in-memory with ZERO database mutations",
      expected: "quiz === null, 0 new DB Quiz records, 0 new DB Question records",
      actual: isPreviewIsolated
        ? "Zero DB writes confirmed, preview questions returned"
        : `Database records changed: quizzes Δ=${quizzesAfterPreview - quizzesBeforePreview}, questions Δ=${questionsAfterPreview - questionsBeforePreview}`,
      status: isPreviewIsolated ? "PASS" : "FAIL",
    });

    // ============================================================================
    // TEST 5: Persistence Lifecycle (saveImmediately = true)
    // ============================================================================
    console.log("--- Executing Test 5: Persistence Lifecycle ---");

    const publishResult = await generateQuizQuestions(
      {
        courseId: testCourseWithChunks.id,
        topic: "Raft Consensus Algorithm",
        difficulty: "Medium",
        questionCount: 2,
        timeLimitMinutes: 15,
        saveImmediately: true,
      },
      testFaculty1.id,
      "FACULTY"
    );

    const savedQuiz = publishResult.quiz;
    if (savedQuiz?.id) createdQuizIds.push(savedQuiz.id);

    const isPublishValid =
      savedQuiz !== null &&
      savedQuiz.isAiGenerated === true &&
      savedQuiz.published === true &&
      savedQuiz.totalQuestions === 2 &&
      savedQuiz.questions.length === 2 &&
      savedQuiz.questions[0].orderIndex === 1 &&
      savedQuiz.questions[1].orderIndex === 2;

    recordTest({
      name: "5. Publish mode creates Quiz in DB with isAiGenerated=true and sequential orderIndex",
      expected: "isAiGenerated: true, totalQuestions: 2, orderIndex: [1, 2]",
      actual: isPublishValid
        ? `Persisted Quiz ID ${savedQuiz.id}, isAiGenerated=${savedQuiz.isAiGenerated}, questions=${savedQuiz.questions.length}`
        : "Failed to persist quiz correctly",
      status: isPublishValid ? "PASS" : "FAIL",
    });

    // ============================================================================
    // TEST 6: Course Vector Grounding vs General Curriculum Fallback
    // ============================================================================
    console.log("--- Executing Test 6: Grounding vs Fallback Semantics ---");

    // 6A. Grounded course with chunks
    const groundedResult = await generateQuizQuestions(
      { courseId: testCourseWithChunks.id, topic: "Raft Consensus", saveImmediately: false },
      testFaculty1.id,
      "FACULTY"
    );

    const isGroundedValid =
      groundedResult.isGrounded === true &&
      groundedResult.sources.length > 0 &&
      groundedResult.groundingNote.includes("Grounded in") &&
      groundedResult.questions[0].sourceCitation.includes("Distributed_Systems_Lec4.pdf");

    recordTest({
      name: "6A. Course with syllabus chunks sets isGrounded=true and cites document",
      expected: "isGrounded: true, sources count > 0, non-empty sourceCitation",
      actual: isGroundedValid
        ? `Grounded in ${groundedResult.sources.length} chunk(s), cited: '${groundedResult.questions[0].sourceCitation}'`
        : `Grounding state invalid: isGrounded=${groundedResult.isGrounded}, sources=${groundedResult.sources.length}`,
      status: isGroundedValid ? "PASS" : "FAIL",
    });

    // 6B. Empty course without chunks -> general curriculum fallback
    const fallbackResult = await generateQuizQuestions(
      { courseId: testCourseWithoutChunks.id, topic: "Graph Algorithms", saveImmediately: false },
      testFaculty1.id,
      "FACULTY"
    );

    const isFallbackValid =
      fallbackResult.isGrounded === false &&
      fallbackResult.sources.length === 0 &&
      fallbackResult.groundingNote.toLowerCase().includes("general curriculum fallback") &&
      fallbackResult.questions.length > 0;

    recordTest({
      name: "6B. Course without chunks sets isGrounded=false and notes 'general curriculum fallback'",
      expected: "isGrounded: false, sources: [], groundingNote mentions 'general curriculum fallback'",
      actual: isFallbackValid
        ? `Fallback confirmed: isGrounded=false, note='${fallbackResult.groundingNote}'`
        : `Fallback state invalid: isGrounded=${fallbackResult.isGrounded}, note='${fallbackResult.groundingNote}'`,
      status: isFallbackValid ? "PASS" : "FAIL",
    });

    // ============================================================================
    // TEST 7: Downstream Student Privacy & Option Masking (REQ-QZ-01)
    // ============================================================================
    console.log("--- Executing Test 7: Student Answer Masking Security ---");

    const studentQuizView = await getQuizById(savedQuiz.id, "STUDENT");
    const facultyQuizView = await getQuizById(savedQuiz.id, "FACULTY");

    const studentQuestions = studentQuizView.questions as any[];
    const facultyQuestions = facultyQuizView.questions as any[];

    const studentHasNoAnswers = studentQuestions.every(
      (q) => q.correctOptionIndex === undefined && q.explanation === undefined
    );
    const facultyHasAnswers = facultyQuestions.every(
      (q) => typeof q.correctOptionIndex === "number" && typeof q.explanation === "string"
    );

    const isPrivacyPreserved = studentHasNoAnswers && facultyHasAnswers;

    recordTest({
      name: "7. Student retrieval masks correctOptionIndex and explanation (REQ-QZ-01)",
      expected: "Student view: undefined answers; Faculty view: complete answers",
      actual: isPrivacyPreserved
        ? "Student view correctly stripped, Faculty view intact"
        : `Privacy violation: studentHasNoAnswers=${studentHasNoAnswers}, facultyHasAnswers=${facultyHasAnswers}`,
      status: isPrivacyPreserved ? "PASS" : "FAIL",
    });

    // ============================================================================
    // TEST 8: Downstream Student Quiz Attempt & Weak Topics Diagnostics
    // ============================================================================
    console.log("--- Executing Test 8: Student Quiz Attempt & Weak Topics Diagnostics ---");

    // Student intentionally answers Question 1 correctly and Question 2 incorrectly
    const q1 = facultyQuestions[0];
    const q2 = facultyQuestions[1];

    const attemptResult = await submitQuizAttempt(savedQuiz.id, testStudent.id, {
      timeSpentSeconds: 95,
      answers: [
        {
          questionId: q1.id,
          selectedOptionIndex: q1.correctOptionIndex, // Correct
        },
        {
          questionId: q2.id,
          selectedOptionIndex: (q2.correctOptionIndex + 1) % 4, // Incorrect!
        },
      ],
    });

    const isAttemptValid =
      attemptResult.score === 10 &&
      attemptResult.totalPoints === 20 &&
      attemptResult.percentage === 50 &&
      attemptResult.weakTopicsIdentified.includes(q2.topic);

    recordTest({
      name: "8. Student attempt scoring and automated weak topic tagging",
      expected: "Score: 10/20 (50%), weakTopicsIdentified includes failed question topic",
      actual: isAttemptValid
        ? `Score: ${attemptResult.score}/${attemptResult.totalPoints} (${attemptResult.percentage}%), weakTopics: [${attemptResult.weakTopicsIdentified.join(", ")}]`
        : `Attempt evaluation failed: score=${attemptResult.score}, weakTopics=${JSON.stringify(attemptResult.weakTopicsIdentified)}`,
      status: isAttemptValid ? "PASS" : "FAIL",
    });

  } catch (error: any) {
    console.error("CRITICAL TEST SUITE ERROR:", error);
    recordTest({
      name: "Fatal Exception in Phase 15 Test Runner",
      expected: "Clean suite execution",
      actual: `Threw unexpected exception: ${error.message}`,
      status: "FAIL",
    });
  } finally {
    // Teardown test entities to maintain database cleanliness
    console.log("--- Cleaning up Phase 15 test entities ---");
    try {
      if (createdQuizIds.length > 0) {
        await prisma.quiz.deleteMany({ where: { id: { in: createdQuizIds } } });
      }
      if (testCourseWithChunks?.id) {
        await prisma.documentChunk.deleteMany({
          where: { material: { courseId: testCourseWithChunks.id } },
        });
        await prisma.material.deleteMany({ where: { courseId: testCourseWithChunks.id } });
        await prisma.enrollment.deleteMany({ where: { courseId: testCourseWithChunks.id } });
        await prisma.course.delete({ where: { id: testCourseWithChunks.id } });
      }
      if (testCourseWithoutChunks?.id) {
        await prisma.course.delete({ where: { id: testCourseWithoutChunks.id } });
      }
      const userIdsToDelete = [
        testFaculty1?.id,
        testFaculty2?.id,
        testStudent?.id,
        testAdmin?.id,
      ].filter(Boolean);
      if (userIdsToDelete.length > 0) {
        await prisma.user.deleteMany({ where: { id: { in: userIdsToDelete } } });
      }
      providerRegistry.setDefaultProviderId("gemini");
      embeddingService.embedText = originalEmbedText;
    } catch (cleanupError: any) {
      console.warn("Teardown warning:", cleanupError.message);
    }
  }

  // Summary
  const passed = reports.filter((r) => r.status === "PASS").length;
  const failed = reports.filter((r) => r.status === "FAIL").length;
  const skipped = reports.filter((r) => r.status === "SKIP").length;

  console.log("================================================================================");
  console.log(`PHASE 15 TEST RESULTS SUMMARY: ${passed} PASSED | ${failed} FAILED | ${skipped} SKIPPED`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests if invoked directly
runPhase15Tests().catch((err) => {
  console.error("FATAL RUNNER FAILURE:", err);
  process.exit(1);
});
