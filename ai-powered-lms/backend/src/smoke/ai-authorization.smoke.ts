import assert from "node:assert/strict";
import test from "node:test";
import prisma from "../lib/prisma.js";
import { createConversation, postMessageToConversation } from "../services/ai.service.js";
import { ragService } from "../services/ai/rag.service.js";
import { studentContextService } from "../services/ai/student-context.service.js";

const course = { id: "course-1", facultyId: "faculty-1" };

test("AI conversation course access is checked at creation and before RAG retrieval", async (t) => {
  let courseRecord: any = course;
  let enrollment: any = { status: "ACTIVE" };
  let conversation: any = { userId: "student-1", courseId: "course-1", course };
  let created = 0;
  const requests = new Map<string, any>();
  let retrieved = 0;
  const replace = (target: any, method: string, implementation: (...args: any[]) => any) => {
    const original = target[method];
    target[method] = implementation;
    t.after(() => {
      target[method] = original;
    });
  };

  replace(prisma.course, "findUnique", async () => courseRecord);
  replace(prisma.enrollment, "findUnique", async () => enrollment);
  replace(prisma.aIConversation, "create", async ({ data }: any) => {
    created += 1;
    return { ...data, id: `conversation-${created}` } as any;
  });
  replace(prisma.aIConversation, "findUnique", async () => conversation);
  replace(prisma.aIMessage, "findMany", async () => []);
  replace(prisma.aIMessage, "create", async ({ data }: any) => data);
  replace(prisma.aIConversation, "update", async () => ({} as any));
  replace(prisma.aIMessageRequest, "create", async ({ data }: any) => {
    const request = { ...data, id: `request-${requests.size + 1}`, userMessageId: null, assistantMessageId: null, completedAt: null, failedAt: null, errorCode: null, errorMessage: null };
    requests.set(request.id, request);
    return request;
  });
  replace(prisma.aIMessageRequest, "findUnique", async ({ where }: any) => requests.get(where.id) || null);
  replace(prisma.aIMessageRequest, "update", async ({ where, data }: any) => {
    const request = requests.get(where.id);
    Object.assign(request, data);
    return request;
  });
  replace(prisma.aIMessageRequest, "updateMany", async () => ({ count: 0 }));
  replace(prisma, "$transaction", async (callback: any) => callback(prisma));
  replace(studentContextService, "getStudentEducationalProfile", async () => ({} as any));
  replace(ragService, "retrieveRelevantChunksWithTiming", async () => {
    retrieved += 1;
    return { chunks: [], embeddingMs: 0, vectorSearchMs: 0 };
  });
  replace(ragService, "generateGroundedTutorResponse", async () => ({
    answer: "Answer",
    sources: [],
    suggestedFollowUps: [],
    isGrounded: false,
  }));

  // Active students may create and use a course conversation.
  await createConversation("student-1", "STUDENT", { courseId: "course-1" });
  await postMessageToConversation("conversation-1", "student-1", "STUDENT", { content: "Help", idempotencyKey: "student-help-1" });
  assert.equal(retrieved, 1);

  // Enrollment changes are rechecked for an existing conversation before RAG.
  enrollment = { status: "DROPPED" };
  await assert.rejects(
    postMessageToConversation("conversation-1", "student-1", "STUDENT", { content: "Help", idempotencyKey: "student-help-2" }),
    { statusCode: 403 }
  );
  assert.equal(retrieved, 1);

  // Non-enrolled students cannot create course conversations.
  enrollment = null;
  await assert.rejects(
    createConversation("student-2", "STUDENT", { courseId: "course-1" }),
    { statusCode: 403 }
  );

  // Only the owning faculty member may use the course tutor.
  await createConversation("faculty-1", "FACULTY", { courseId: "course-1" });
  conversation = { userId: "faculty-1", courseId: "course-1", course };
  await postMessageToConversation("conversation-1", "faculty-1", "FACULTY", { content: "Faculty help", idempotencyKey: "faculty-help-1" });
  assert.equal(retrieved, 2);
  await assert.rejects(
    createConversation("faculty-2", "FACULTY", { courseId: "course-1" }),
    { statusCode: 403 }
  );
  conversation = { userId: "faculty-2", courseId: "course-1", course };
  await assert.rejects(
    postMessageToConversation("conversation-1", "faculty-2", "FACULTY", { content: "Help", idempotencyKey: "faculty-help-2" }),
    { statusCode: 403 }
  );

  // Course existence is validated before role access checks.
  courseRecord = null;
  await assert.rejects(
    createConversation("student-1", "STUDENT", { courseId: "missing-course" }),
    { statusCode: 404 }
  );
  conversation = { userId: "student-1", courseId: "missing-course", course: null };
  await assert.rejects(
    postMessageToConversation("missing-conversation", "student-1", "STUDENT", { content: "Help" }),
    { statusCode: 404 }
  );

  // No documented administrator course-content policy exists: deny safely.
  courseRecord = course;
  await assert.rejects(
    createConversation("admin-1", "ADMIN", { courseId: "course-1" }),
    { statusCode: 403 }
  );

  // Course-independent conversations remain available and never invoke RAG.
  const independent = await createConversation("student-1", "STUDENT", {});
  assert.equal(independent.courseId, null);
  conversation = { userId: "student-1", courseId: null, course: null };
  await postMessageToConversation("independent", "student-1", "STUDENT", { content: "General help", idempotencyKey: "general-help-1" });
  assert.equal(retrieved, 2);
});
