import "dotenv/config";
import prisma from "../lib/prisma.js";
import {
  generateQuizQuestions,
  validateGeneratedQuestions,
  QuizResponseSchema,
} from "../services/ai/quiz-generator.service.js";
import { getQuizById, submitQuizAttempt, createQuiz } from "../services/quiz.service.js";
import { generateQuiz } from "../controllers/ai.controller.js";
import { providerRegistry } from "../services/ai/providers/provider.registry.js";
import { LLMProvider, LLMGenerationResult, LLMGenerationOptions } from "../services/ai/providers/llm-provider.interface.js";
import { embeddingService } from "../services/ai/embedding.service.js";
import { ragService } from "../services/ai/rag.service.js";
import { quizPublicationIdempotency } from "../lib/idempotency.js";

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

function createMockRes() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

/**
 * Mock LLM Provider for deterministic, quota-free unit testing of generation, schema, and lifecycle.
 */
class MockQuizLLMProvider implements LLMProvider {
  public readonly providerId = "mock-quiz-llm";
  public readonly modelName = "mock-quiz-model";
  private customResponseText: string | null = null;
  public lastPrompt: string | null = null;

  public setNextResponse(jsonText: string | null) {
    this.customResponseText = jsonText;
  }

  public async generateCompletion(
    prompt: string,
    options?: LLMGenerationOptions
  ): Promise<LLMGenerationResult> {
    this.lastPrompt = prompt;
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
    const isGroundedPrompt = prompt.includes("<syllabus_context>");
    const countMatch = prompt.match(/Requested Question Count:\s*(\d+)/);
    const requestedCount = countMatch ? parseInt(countMatch[1], 10) : 2;

    const baseQuestions = [
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
    ];

    const questions = [];
    for (let i = 0; i < requestedCount; i++) {
      const template = baseQuestions[i % baseQuestions.length];
      questions.push({
        ...template,
        question: i >= 2 ? `${template.question} (Variation ${i + 1})` : template.question,
        topic: i >= 2 ? `${template.topic} Var ${i + 1}` : template.topic,
      });
    }

    const defaultData = {
      quizTitle: "Consensus Algorithms Assessment",
      questions,
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

  const originalDefaultProviderId = (providerRegistry as any).defaultProviderId || "gemini";
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
  let testMaterial1: any = null;
  let testMaterial2: any = null;
  const createdQuizIds: string[] = [];

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

    // Seed Material 1 and DocumentChunk for Course 1
    testMaterial1 = await prisma.material.create({
      data: {
        courseId: testCourseWithChunks.id,
        title: "Distributed_Systems_Lec4.pdf",
        unit: "Unit 2: Consensus",
        fileUrl: "/uploads/materials/test-p15.pdf",
        fileType: "application/pdf",
        fileSize: "1.2 MB",
      },
    });

    await prisma.$executeRawUnsafe(
      `
      INSERT INTO "DocumentChunk" (id, "materialId", "chunkIndex", "pageNumber", content, "tokenCount", "characterCount", embedding)
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, array_fill(0.01::float4, ARRAY[3072])::vector
      );
      `,
      `chunk-p15-1-${timestamp}`,
      testMaterial1.id,
      0,
      14,
      "The Raft consensus algorithm utilizes randomized election timeouts to ensure split votes are quickly resolved among candidates.",
      25,
      126
    );

    // Seed Material 2 and DocumentChunk for Course 1
    testMaterial2 = await prisma.material.create({
      data: {
        courseId: testCourseWithChunks.id,
        title: "Storage_Engines_Lec8.pdf",
        unit: "Unit 3: Storage",
        fileUrl: "/uploads/materials/test-p15-storage.pdf",
        fileType: "application/pdf",
        fileSize: "1.5 MB",
      },
    });

    await prisma.$executeRawUnsafe(
      `
      INSERT INTO "DocumentChunk" (id, "materialId", "chunkIndex", "pageNumber", content, "tokenCount", "characterCount", embedding)
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, array_fill(0.01::float4, ARRAY[3072])::vector
      );
      `,
      `chunk-p15-2-${timestamp}`,
      testMaterial2.id,
      0,
      22,
      "Log-structured merge trees batch random writes into sequential disk operations for high throughput.",
      22,
      105
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
            options: ["Option A", "Option A", "Option B", "Option C"],
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
            options: ["Option 1", "Option 2", "Option 3"],
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
            correctOptionIndex: 4,
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
            bloomsLevel: "InvalidLevel",
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
            sourceCitation: "",
          },
        ],
        true
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
            sourceCitation: "",
          },
        ],
        false
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
        testFaculty2.id,
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
    // TEST 3: Input Validation Guards (Service-level)
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

    const q1 = facultyQuestions[0];
    const q2 = facultyQuestions[1];

    const attemptResult = await submitQuizAttempt(savedQuiz.id, testStudent.id, {
      timeSpentSeconds: 95,
      answers: [
        {
          questionId: q1.id,
          selectedOptionIndex: q1.correctOptionIndex,
        },
        {
          questionId: q2.id,
          selectedOptionIndex: (q2.correctOptionIndex + 1) % 4,
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

    // ============================================================================
    // TEST 9: Structured Schema Requires sourceCitation
    // ============================================================================
    console.log("--- Executing Test 9: Structured Schema Requires sourceCitation ---");

    const questionProps = QuizResponseSchema.properties.questions.items.properties;
    const questionRequired = QuizResponseSchema.properties.questions.items.required;
    const isCitationRequired =
      Boolean(questionProps.sourceCitation) && questionRequired.includes("sourceCitation");

    recordTest({
      name: "9. Require sourceCitation in structured Gemini JSON schema",
      expected: "sourceCitation defined in properties and included in question required array",
      actual: isCitationRequired
        ? "sourceCitation is explicitly required in QuizResponseSchema"
        : `Required fields: ${JSON.stringify(questionRequired)}`,
      status: isCitationRequired ? "PASS" : "FAIL",
    });

    // ============================================================================
    // TEST 10: Citation Validation Against Retrieved Chunks
    // ============================================================================
    console.log("--- Executing Test 10: Citation Validation Against Retrieved Chunks ---");

    const validChunks = [{ documentName: "Distributed_Systems_Lec4.pdf" }];

    // 10A: Reject citation not matching any retrieved chunks
    let hallucinatedRejected = false;
    try {
      validateGeneratedQuestions(
        [
          {
            question: "Question with fake citation?",
            options: ["A", "B", "C", "D"],
            correctOptionIndex: 0,
            explanation: "Explanation",
            bloomsLevel: "Apply",
            difficulty: "Medium",
            topic: "Consensus",
            sourceCitation: "Completely_Made_Up_Book.pdf (Unit 9, Page 99)",
          },
        ],
        true,
        { validSources: validChunks }
      );
    } catch (err: any) {
      if (err.statusCode === 422 && err.message.includes("does not reference any retrieved course material chunks")) {
        hallucinatedRejected = true;
      }
    }

    recordTest({
      name: "10A. Reject grounded question with hallucinated sourceCitation not in chunks",
      expected: "HTTP 422 rejection when citation doesn't match retrieved chunks",
      actual: hallucinatedRejected
        ? "HTTP 422 (Hallucinated document citation rejected)"
        : "Failed to reject citation from unknown source",
      status: hallucinatedRejected ? "PASS" : "FAIL",
    });

    // 10B: Accept citation matching retrieved chunk documentName
    let validCitationAccepted = false;
    try {
      const res = validateGeneratedQuestions(
        [
          {
            question: "Question with authentic citation?",
            options: ["A", "B", "C", "D"],
            correctOptionIndex: 0,
            explanation: "Explanation",
            bloomsLevel: "Apply",
            difficulty: "Medium",
            topic: "Consensus",
            sourceCitation: "Distributed_Systems_Lec4.pdf (Unit 2, Page 14)",
          },
        ],
        true,
        { validSources: validChunks }
      );
      validCitationAccepted = res.length === 1;
    } catch (err: any) {
      validCitationAccepted = false;
    }

    recordTest({
      name: "10B. Accept grounded question citing authentic retrieved chunk",
      expected: "Validation passes for matching chunk documentName",
      actual: validCitationAccepted ? "Validated chunk citation successfully" : "Failed to accept valid citation",
      status: validCitationAccepted ? "PASS" : "FAIL",
    });

    // ============================================================================
    // TEST 11: Enforce Question Count == ExpectedCount
    // ============================================================================
    console.log("--- Executing Test 11: Question Count Enforcement ---");

    let countMismatchRejected = false;
    try {
      validateGeneratedQuestions(
        [
          {
            question: "Q1?",
            options: ["A", "B", "C", "D"],
            correctOptionIndex: 0,
            explanation: "E1",
            bloomsLevel: "Understand",
            difficulty: "Easy",
            topic: "T1",
            sourceCitation: "",
          },
        ],
        false,
        { expectedCount: 3 } // requested 3, but received 1!
      );
    } catch (err: any) {
      if (err.statusCode === 422 && err.message.includes("expected exactly 3 questions")) {
        countMismatchRejected = true;
      }
    }

    recordTest({
      name: "11. Enforce generated question count equals expectedCount",
      expected: "HTTP 422 with 'expected exactly 3 questions, but model returned 1'",
      actual: countMismatchRejected
        ? "HTTP 422 (Question count mismatch rejected)"
        : "Failed to enforce question count",
      status: countMismatchRejected ? "PASS" : "FAIL",
    });

    // ============================================================================
    // TEST 12: MaterialIds Applied Before Top-6 Vector Retrieval
    // ============================================================================
    console.log("--- Executing Test 12: MaterialIds Filtering in pgvector Retrieval ---");

    const storageOnlyRetrieval = await ragService.retrieveRelevantChunksWithTiming(
      "write performance",
      testCourseWithChunks.id,
      {
        topK: 6,
        minSimilarity: 0.1,
        materialIds: [testMaterial2.id], // Only storage lecture!
      }
    );

    const allFromMaterial2 =
      storageOnlyRetrieval.chunks.length > 0 &&
      storageOnlyRetrieval.chunks.every((c) => c.materialId === testMaterial2.id);

    recordTest({
      name: "12. Apply materialIds filter directly in pgvector retrieval query",
      expected: "All retrieved chunks strictly match materialIds filter",
      actual: allFromMaterial2
        ? `Retrieved ${storageOnlyRetrieval.chunks.length} chunk(s) all matching target materialId`
        : `Chunks returned outside filter or empty: ${JSON.stringify(storageOnlyRetrieval.chunks)}`,
      status: allFromMaterial2 ? "PASS" : "FAIL",
    });

    // ============================================================================
    // TEST 13: Prevent Ungrounded Fallback Publication Without Explicit Acknowledgment
    // ============================================================================
    console.log("--- Executing Test 13: Ungrounded Fallback Publication Server-Side Guard ---");

    // 13A: Reject publish when isGrounded = false and fallbackAcknowledged is false
    let unacknowledgedFallbackBlocked = false;
    try {
      await generateQuizQuestions(
        {
          courseId: testCourseWithoutChunks.id,
          topic: "Complexity Theory",
          saveImmediately: true,
          fallbackAcknowledged: false, // Not acknowledged!
        },
        testFaculty1.id,
        "FACULTY"
      );
    } catch (err: any) {
      if (err.statusCode === 400 && err.message.includes("fallbackAcknowledged")) {
        unacknowledgedFallbackBlocked = true;
      }
    }

    recordTest({
      name: "13A. Prevent ungrounded fallback publish without explicit acknowledgment",
      expected: "HTTP 400 rejection requiring fallbackAcknowledged confirmation",
      actual: unacknowledgedFallbackBlocked
        ? "HTTP 400 (Ungrounded fallback publish rejected without acknowledgment)"
        : "Allowed ungrounded publish without acknowledgment",
      status: unacknowledgedFallbackBlocked ? "PASS" : "FAIL",
    });

    // 13B: Permit publish when isGrounded = false and fallbackAcknowledged is true
    let acknowledgedFallbackAllowed = false;
    let fallbackQuizId: string | null = null;
    try {
      const res = await generateQuizQuestions(
        {
          courseId: testCourseWithoutChunks.id,
          topic: "Complexity Theory",
          questionCount: 2,
          saveImmediately: true,
          fallbackAcknowledged: true, // Explicitly acknowledged!
        },
        testFaculty1.id,
        "FACULTY"
      );
      if (res.quiz?.id) {
        fallbackQuizId = res.quiz.id;
        createdQuizIds.push(fallbackQuizId!);
        acknowledgedFallbackAllowed = true;
      }
    } catch (err: any) {
      acknowledgedFallbackAllowed = false;
    }

    recordTest({
      name: "13B. Permit ungrounded fallback publish with explicit fallbackAcknowledged: true",
      expected: "HTTP 201 / success when fallbackAcknowledged is true",
      actual: acknowledgedFallbackAllowed
        ? `Successfully published ungrounded quiz with ID ${fallbackQuizId}`
        : "Failed to publish despite acknowledgment",
      status: acknowledgedFallbackAllowed ? "PASS" : "FAIL",
    });

    // ============================================================================
    // TEST 14: Safely Parse Model JSON as Unknown & Validate Root Object
    // ============================================================================
    console.log("--- Executing Test 14: Safe Parsing as Unknown & Root Object Validation ---");

    // 14A: Model generates JSON array instead of object
    mockProvider.setNextResponse(JSON.stringify([{ question: "Root array error" }]));
    let arrayRootRejected = false;
    try {
      await generateQuizQuestions(
        { courseId: testCourseWithChunks.id, topic: "Raft", saveImmediately: false },
        testFaculty1.id,
        "FACULTY"
      );
    } catch (err: any) {
      if (err.statusCode === 502 && err.message.includes("root must be a JSON object")) {
        arrayRootRejected = true;
      }
    }

    recordTest({
      name: "14A. Reject LLM JSON output when root is an array instead of an object",
      expected: "HTTP 502 Bad Gateway with root object validation message",
      actual: arrayRootRejected ? "HTTP 502 (Invalid root array rejected)" : "Failed to catch invalid root array",
      status: arrayRootRejected ? "PASS" : "FAIL",
    });

    // 14B: Model generates object without questions array
    mockProvider.setNextResponse(JSON.stringify({ quizTitle: "Missing questions", questions: "not-an-array" }));
    let nonArrayQuestionsRejected = false;
    try {
      await generateQuizQuestions(
        { courseId: testCourseWithChunks.id, topic: "Raft", saveImmediately: false },
        testFaculty1.id,
        "FACULTY"
      );
    } catch (err: any) {
      if (err.statusCode === 502 && err.message.includes("'questions' property must be a JSON array")) {
        nonArrayQuestionsRejected = true;
      }
    }

    recordTest({
      name: "14B. Reject LLM JSON output when questions property is not an array",
      expected: "HTTP 502 Bad Gateway with 'questions property must be a JSON array'",
      actual: nonArrayQuestionsRejected
        ? "HTTP 502 (Non-array questions rejected)"
        : "Failed to catch non-array questions",
      status: nonArrayQuestionsRejected ? "PASS" : "FAIL",
    });

    // ============================================================================
    // TEST 15: Prompt Boundaries Protect Against Prompt Injection
    // ============================================================================
    console.log("--- Executing Test 15: Prompt Boundaries & Tag Encapsulation ---");

    await generateQuizQuestions(
      { courseId: testCourseWithChunks.id, topic: "Syllabus Injection Test", saveImmediately: false },
      testFaculty1.id,
      "FACULTY"
    );

    const generatedPrompt = mockProvider.lastPrompt || "";
    const hasPromptBoundaries =
      generatedPrompt.includes("<topic_data>") &&
      generatedPrompt.includes("</topic_data>") &&
      generatedPrompt.includes("<syllabus_context>") &&
      generatedPrompt.includes("CRITICAL INSTRUCTION FOR DATA INTEGRITY & BOUNDARIES");

    recordTest({
      name: "15. Encapsulate untrusted topic and syllabus data within XML prompt boundaries",
      expected: "Prompt wraps untrusted data in <topic_data> and <syllabus_context> with boundary instructions",
      actual: hasPromptBoundaries
        ? "Prompt boundaries verified: <topic_data>, <syllabus_context>, and safety instructions active"
        : "Prompt boundary tags missing",
      status: hasPromptBoundaries ? "PASS" : "FAIL",
    });

    // ============================================================================
    // TEST 16: Database-Enforced Publication Idempotency
    // ============================================================================
    console.log("--- Executing Test 16: Database-Enforced Publication Idempotency ---");

    // 16A: First publish creates exactly one quiz
    const idempotencyKey = `p15_test_idem_${Date.now()}`;
    const initialQuizCount = await prisma.quiz.count({ where: { courseId: testCourseWithChunks.id } });

    const firstPub = await generateQuizQuestions(
      {
        courseId: testCourseWithChunks.id,
        topic: "Idempotency Verification",
        questionCount: 2,
        saveImmediately: true,
        idempotencyKey,
      },
      testFaculty1.id,
      "FACULTY"
    );

    if (firstPub.quiz?.id) createdQuizIds.push(firstPub.quiz.id);

    const countAfterFirst = await prisma.quiz.count({ where: { courseId: testCourseWithChunks.id } });
    const firstPubCreatedOne = countAfterFirst === initialQuizCount + 1 && firstPub.quiz !== null;

    recordTest({
      name: "16A. First publish with idempotency key creates exactly one quiz",
      expected: "Exactly 1 new Quiz row; quiz.id is non-null",
      actual: firstPubCreatedOne
        ? `Created Quiz ID ${firstPub.quiz?.id}, DB count Δ=1`
        : `DB count Δ=${countAfterFirst - initialQuizCount}, quiz.id=${firstPub.quiz?.id}`,
      status: firstPubCreatedOne ? "PASS" : "FAIL",
    });

    // 16B: Retry with same key returns the existing quiz (no new DB row)
    const secondPub = await generateQuizQuestions(
      {
        courseId: testCourseWithChunks.id,
        topic: "Idempotency Verification",
        questionCount: 2,
        saveImmediately: true,
        idempotencyKey,
      },
      testFaculty1.id,
      "FACULTY"
    );

    const countAfterRetry = await prisma.quiz.count({ where: { courseId: testCourseWithChunks.id } });
    const isRetryIdempotent =
      firstPub.quiz?.id === secondPub.quiz?.id &&
      countAfterRetry === countAfterFirst; // No new row created

    recordTest({
      name: "16B. Retry with same idempotency key returns existing quiz without creating a duplicate",
      expected: "Same quiz ID returned, DB count unchanged",
      actual: isRetryIdempotent
        ? `Idempotency verified: identical Quiz ID ${firstPub.quiz?.id}, DB count Δ=0`
        : `Duplicate created! First ID=${firstPub.quiz?.id}, Second ID=${secondPub.quiz?.id}, count Δ=${countAfterRetry - countAfterFirst}`,
      status: isRetryIdempotent ? "PASS" : "FAIL",
    });

    // 16C: Concurrent requests with same key create exactly one quiz
    const concurrentKey = `p15_concurrent_${Date.now()}`;
    const preConcurrentCount = await prisma.quiz.count({ where: { courseId: testCourseWithChunks.id } });

    const [callA, callB] = await Promise.all([
      generateQuizQuestions(
        {
          courseId: testCourseWithChunks.id,
          topic: "Concurrent Raft",
          questionCount: 2,
          saveImmediately: true,
          idempotencyKey: concurrentKey,
        },
        testFaculty1.id,
        "FACULTY"
      ),
      generateQuizQuestions(
        {
          courseId: testCourseWithChunks.id,
          topic: "Concurrent Raft",
          questionCount: 2,
          saveImmediately: true,
          idempotencyKey: concurrentKey,
        },
        testFaculty1.id,
        "FACULTY"
      ),
    ]);

    if (callA.quiz?.id) createdQuizIds.push(callA.quiz.id);
    const postConcurrentCount = await prisma.quiz.count({ where: { courseId: testCourseWithChunks.id } });

    const isConcurrentSafe =
      callA.quiz?.id === callB.quiz?.id &&
      postConcurrentCount === preConcurrentCount + 1;

    recordTest({
      name: "16C. Concurrent publishes with same idempotency key create exactly one quiz",
      expected: "Both concurrent requests resolve to the exact same Quiz ID with 1 database insertion",
      actual: isConcurrentSafe
        ? `Concurrent safe: both resolved to ${callA.quiz?.id}, DB count Δ=1`
        : `Race condition created duplicates! A=${callA.quiz?.id}, B=${callB.quiz?.id}`,
      status: isConcurrentSafe ? "PASS" : "FAIL",
    });

    // 16D: Different keys intentionally create separate quizzes
    const keyD1 = `p15_diff_1_${Date.now()}`;
    const keyD2 = `p15_diff_2_${Date.now() + 1}`;
    const preDistinctCount = await prisma.quiz.count({ where: { courseId: testCourseWithChunks.id } });

    const pubD1 = await generateQuizQuestions(
      { courseId: testCourseWithChunks.id, topic: "Different Key Quiz A", questionCount: 2, saveImmediately: true, idempotencyKey: keyD1 },
      testFaculty1.id, "FACULTY"
    );
    const pubD2 = await generateQuizQuestions(
      { courseId: testCourseWithChunks.id, topic: "Different Key Quiz B", questionCount: 2, saveImmediately: true, idempotencyKey: keyD2 },
      testFaculty1.id, "FACULTY"
    );

    if (pubD1.quiz?.id) createdQuizIds.push(pubD1.quiz.id);
    if (pubD2.quiz?.id) createdQuizIds.push(pubD2.quiz.id);

    const postDistinctCount = await prisma.quiz.count({ where: { courseId: testCourseWithChunks.id } });
    const areDifferentKeys =
      pubD1.quiz?.id !== pubD2.quiz?.id &&
      pubD1.quiz?.id !== null &&
      pubD2.quiz?.id !== null &&
      postDistinctCount === preDistinctCount + 2;

    recordTest({
      name: "16D. Different idempotency keys create separate independent quizzes",
      expected: "Two distinct Quiz IDs created, DB count increases by 2",
      actual: areDifferentKeys
        ? `Two separate quizzes: ${pubD1.quiz?.id} and ${pubD2.quiz?.id}, DB count Δ=2`
        : `Expected 2 separate quizzes, got: D1=${pubD1.quiz?.id}, D2=${pubD2.quiz?.id}, count Δ=${postDistinctCount - preDistinctCount}`,
      status: areDifferentKeys ? "PASS" : "FAIL",
    });

    // 16E: Persistence survives in-memory cache eviction (simulating process restart)
    // We clear the IdempotencyManager cache then re-call with the same key;
    // the DB UNIQUE constraint must still return the existing quiz, not create a duplicate.
    quizPublicationIdempotency.clear(); // Evict all in-memory state
    const preEvictCount = await prisma.quiz.count({ where: { courseId: testCourseWithChunks.id } });

    const postEvictPub = await generateQuizQuestions(
      {
        courseId: testCourseWithChunks.id,
        topic: "Idempotency Verification",
        questionCount: 2,
        saveImmediately: true,
        idempotencyKey, // Same key as 16A/16B
      },
      testFaculty1.id,
      "FACULTY"
    );

    const postEvictCount = await prisma.quiz.count({ where: { courseId: testCourseWithChunks.id } });
    const isPersistentAfterEviction =
      postEvictPub.quiz?.id === firstPub.quiz?.id &&
      postEvictCount === preEvictCount; // No new row

    recordTest({
      name: "16E. DB-enforced idempotency persists after in-memory cache is cleared (process restart simulation)",
      expected: "Same quiz ID as original, no new DB row created even after cache eviction",
      actual: isPersistentAfterEviction
        ? `Persistent idempotency confirmed: quiz ID ${postEvictPub.quiz?.id} unchanged, DB count Δ=0`
        : `Memory-only failure! Post-evict ID=${postEvictPub.quiz?.id} vs original=${firstPub.quiz?.id}, count Δ=${postEvictCount - preEvictCount}`,
      status: isPersistentAfterEviction ? "PASS" : "FAIL",
    });

    // 16F: Wrong course cannot reuse another course's idempotency key
    // Use an existing key from Course 1 and try to publish to Course 2 (without chunks / different scope)
    let crossCourseKeyRejected = false;
    let crossCourseError = "";
    try {
      await generateQuizQuestions(
        {
          courseId: testCourseWithoutChunks.id, // Different course!
          topic: "Complexity Theory",
          questionCount: 2,
          saveImmediately: true,
          fallbackAcknowledged: true,
          idempotencyKey, // Key bound to testCourseWithChunks
        },
        testFaculty1.id,
        "FACULTY"
      );
      // If this succeeds it means the DB found an existing quiz bound to a different course
      // and either returned it (wrong course) or created a new one (correct — different scope).
      // We verify by checking the courseId of the returned quiz.
      crossCourseError = "succeeded without error — verifying returned quiz scope";
    } catch (err: any) {
      if (err.statusCode === 409) {
        crossCourseKeyRejected = true;
        crossCourseError = err.message;
      } else {
        // Any other error (wrong status, unexpected exception) is a test failure.
        crossCourseKeyRejected = false;
        crossCourseError = `Expected 409 but got ${err.statusCode ?? "unknown"}: ${err.message}`;
      }
    }

    recordTest({
      name: "16F. Cross-course idempotency key collision is rejected with 409",
      expected: "HTTP 409 when a key bound to one course is used for a different course",
      actual: crossCourseKeyRejected
        ? `Correctly rejected cross-course reuse: ${crossCourseError}`
        : `Cross-course reuse allowed (potential security gap): ${crossCourseError}`,
      status: crossCourseKeyRejected ? "PASS" : "FAIL",
    });

    // ============================================================================
    // TEST 17: Controller-Level Complete Request Body Runtime Validation
    // ============================================================================
    console.log("--- Executing Test 17: Controller Request Body Runtime Validation ---");

    // 17A: Invalid difficulty
    const resDiff = createMockRes();
    await generateQuiz(
      {
        user: { userId: testFaculty1.id, role: "FACULTY" },
        body: { courseId: testCourseWithChunks.id, topic: "Raft", difficulty: "Extreme" },
      } as any,
      resDiff,
      () => {}
    );
    const diffValidated =
      resDiff.statusCode === 400 && resDiff.body?.message?.includes("difficulty must be one of");

    recordTest({
      name: "17A. Controller rejects invalid difficulty enum at runtime",
      expected: "HTTP 400 Bad Request",
      actual: diffValidated ? "HTTP 400 (Invalid difficulty rejected)" : `Status: ${resDiff.statusCode}`,
      status: diffValidated ? "PASS" : "FAIL",
    });

    // 17B: Invalid questionCount (< 1 or > 10)
    const resCount = createMockRes();
    await generateQuiz(
      {
        user: { userId: testFaculty1.id, role: "FACULTY" },
        body: { courseId: testCourseWithChunks.id, topic: "Raft", questionCount: 15 },
      } as any,
      resCount,
      () => {}
    );
    const countValidated =
      resCount.statusCode === 400 && resCount.body?.message?.includes("questionCount must be an integer between 1 and 10");

    recordTest({
      name: "17B. Controller rejects out-of-bounds questionCount (> 10) at runtime",
      expected: "HTTP 400 Bad Request",
      actual: countValidated ? "HTTP 400 (questionCount 15 rejected)" : `Status: ${resCount.statusCode}`,
      status: countValidated ? "PASS" : "FAIL",
    });

    // 17C: Invalid materialIds (not an array of non-empty strings)
    const resMat = createMockRes();
    await generateQuiz(
      {
        user: { userId: testFaculty1.id, role: "FACULTY" },
        body: { courseId: testCourseWithChunks.id, topic: "Raft", materialIds: [""] },
      } as any,
      resMat,
      () => {}
    );
    const matValidated =
      resMat.statusCode === 400 && resMat.body?.message?.includes("materialIds must be an array of non-empty string identifiers");

    recordTest({
      name: "17C. Controller rejects invalid materialIds format at runtime",
      expected: "HTTP 400 Bad Request",
      actual: matValidated ? "HTTP 400 (Invalid materialIds rejected)" : `Status: ${resMat.statusCode}`,
      status: matValidated ? "PASS" : "FAIL",
    });

    // 17D: Invalid saveImmediately type (not boolean)
    const resSave = createMockRes();
    await generateQuiz(
      {
        user: { userId: testFaculty1.id, role: "FACULTY" },
        body: { courseId: testCourseWithChunks.id, topic: "Raft", saveImmediately: "yes" },
      } as any,
      resSave,
      () => {}
    );
    const saveValidated =
      resSave.statusCode === 400 && resSave.body?.message?.includes("saveImmediately must be a boolean");

    recordTest({
      name: "17D. Controller rejects non-boolean saveImmediately at runtime",
      expected: "HTTP 400 Bad Request",
      actual: saveValidated ? "HTTP 400 (Non-boolean saveImmediately rejected)" : `Status: ${resSave.statusCode}`,
      status: saveValidated ? "PASS" : "FAIL",
    });

    // 17E: Invalid fallbackAcknowledged type (not boolean)
    const resAck = createMockRes();
    await generateQuiz(
      {
        user: { userId: testFaculty1.id, role: "FACULTY" },
        body: { courseId: testCourseWithChunks.id, topic: "Raft", fallbackAcknowledged: "true" },
      } as any,
      resAck,
      () => {}
    );
    const ackValidated =
      resAck.statusCode === 400 && resAck.body?.message?.includes("fallbackAcknowledged must be a boolean");

    recordTest({
      name: "17E. Controller rejects non-boolean fallbackAcknowledged at runtime",
      expected: "HTTP 400 Bad Request",
      actual: ackValidated ? "HTTP 400 (Non-boolean fallbackAcknowledged rejected)" : `Status: ${resAck.statusCode}`,
      status: ackValidated ? "PASS" : "FAIL",
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
    // 1. ALWAYS restore test mocks and registry state FIRST in its own try/catch (Item 11)
    try {
      providerRegistry.setDefaultProviderId(originalDefaultProviderId);
      embeddingService.embedText = originalEmbedText;
      quizPublicationIdempotency.clear();
    } catch (restoreErr: any) {
      console.warn("Mock restoration warning:", restoreErr.message);
    }

    // 2. Clean up database test entities in separate try/catch
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
