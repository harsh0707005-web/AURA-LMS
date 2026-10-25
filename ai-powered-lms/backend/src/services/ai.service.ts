import { createHash } from "node:crypto";
import prisma from "../lib/prisma.js";
import { CreateAIConversationInput, PostAIMessageInput } from "../types/academic.types.js";
import { ragService } from "./ai/rag.service.js";
import { studentContextService } from "./ai/student-context.service.js";
import { resolveWebsiteContext } from "./ai/website-context.service.js";

const MAX_MESSAGE_CHARS = 8000;
const MAX_HISTORY_CHARS = 6000;
const DEFAULT_RAG_THRESHOLD = Number(process.env.RAG_MIN_SIMILARITY) || 0.55;
const MIN_PROVIDER_REQUEST_BUDGET_MS = 10_000;

type TutorTiming = {
  embeddingMs: number;
  vectorSearchMs: number;
  retrievalMs: number;
  rawCandidateCount: number;
  acceptedCandidateCount: number;
  minSimilarity: number;
  retrievalStatus: "accepted" | "no-candidates" | "below-threshold" | "embedding-error" | "vector-search-error" | "no-course-context";
  contextAssemblyMs: number;
  generationMs: number;
  totalRoundTripMs: number;
  serverTotalMs?: number;
  personalizationAvailable?: boolean;
  personalizationIncluded?: boolean;
  thinkingBudgetUsed?: number;
  promptChars?: number;
  outputChars?: number;
  providerAttemptCount?: number;
  fallbackUsed?: boolean;
  retryCount?: number;
  backoffMs?: number;
};

async function authorizeCourseConversation(userId: string, role: string, courseId?: string | null): Promise<void> {
  if (!courseId) return;
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, facultyId: true } });
  if (!course) throw Object.assign(new Error("Course not found"), { statusCode: 404 });
  // There is no documented policy granting administrators access to course
  // learning content through the AI tutor. Keep course-bound access
  // deny-by-default until that policy is explicitly decided and implemented.
  if (role === "ADMIN") {
    throw Object.assign(new Error("Forbidden: Administrator course AI access is not enabled by policy"), { statusCode: 403 });
  }
  if (role === "FACULTY") {
    if (course.facultyId !== userId) throw Object.assign(new Error("Forbidden: Faculty may only access their own courses"), { statusCode: 403 });
    return;
  }
  if (role === "STUDENT") {
    const enrollment = await prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId: userId, courseId } },
      select: { status: true },
    });
    if (!enrollment || enrollment.status !== "ACTIVE") throw Object.assign(new Error("Forbidden: An active course enrollment is required"), { statusCode: 403 });
    return;
  }
  throw Object.assign(new Error("Forbidden: Unsupported user role"), { statusCode: 403 });
}

export async function getUserConversations(userId: string, role: string) {
  const conversations = await prisma.aIConversation.findMany({
    where: { userId },
    include: {
      course: {
        select: { id: true, code: true, title: true },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Listing is also a read of course-bound learning content. Re-check current
  // access so a dropped student cannot keep browsing old grounded transcripts.
  const visible: typeof conversations = [];
  for (const conversation of conversations) {
    try {
      await authorizeCourseConversation(userId, role, conversation.courseId);
      visible.push(conversation);
    } catch (error: any) {
      if (error?.statusCode !== 403) throw error;
    }
  }
  return visible;
}

export async function getConversationById(conversationId: string, userId: string, role: string) {
  const conversation = await prisma.aIConversation.findUnique({
    where: { id: conversationId },
    include: {
      course: {
        select: { id: true, code: true, title: true, department: true, semester: true },
      },
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!conversation) {
    throw Object.assign(new Error("Conversation not found"), { statusCode: 404 });
  }

  if (conversation.userId !== userId) {
    throw Object.assign(new Error("Forbidden: Access denied to this conversation"), { statusCode: 403 });
  }

  await authorizeCourseConversation(userId, role, conversation.courseId);

  return conversation;
}

export async function createConversation(userId: string, role: string, input: CreateAIConversationInput) {
  await authorizeCourseConversation(userId, role, input.courseId);
  return await prisma.aIConversation.create({
    data: {
      userId,
      courseId: input.courseId || null,
      title: input.title || "Academic Q&A Session",
    },
    include: {
      course: true,
      messages: true,
    },
  });
}

export async function deleteConversation(conversationId: string, userId: string, role: string) {
  const conversation = await prisma.aIConversation.findUnique({ where: { id: conversationId } });
  if (!conversation) {
    throw Object.assign(new Error("Conversation not found"), { statusCode: 404 });
  }

  if (conversation.userId !== userId) {
    throw Object.assign(new Error("Forbidden: Access denied to this conversation"), { statusCode: 403 });
  }

  await authorizeCourseConversation(userId, role, conversation.courseId);

  await prisma.aIConversation.delete({ where: { id: conversationId } });
  return { message: "Conversation deleted successfully" };
}

export async function postMessageToConversation(
  conversationId: string,
  userId: string,
  role: string,
  input: PostAIMessageInput
) {
  const requestStartedAt = performance.now();
  const conversation = await prisma.aIConversation.findUnique({
    where: { id: conversationId },
    include: { course: true },
  });

  if (!conversation) {
    throw Object.assign(new Error("Conversation not found"), { statusCode: 404 });
  }

  if (conversation.userId !== userId) {
    throw Object.assign(new Error("Forbidden: Access denied to this conversation"), { statusCode: 403 });
  }

  await authorizeCourseConversation(userId, role, conversation.courseId);

  if (!input || typeof input !== "object" || typeof input.content !== "string") {
    throw Object.assign(new Error("Message content must be a string"), { statusCode: 400 });
  }

  const content = input.content.trim();
  if (!content) {
    throw Object.assign(new Error("Message content cannot be empty"), { statusCode: 400 });
  }
  if (content.length > MAX_MESSAGE_CHARS) {
    throw Object.assign(new Error(`Message content cannot exceed ${MAX_MESSAGE_CHARS} characters`), { statusCode: 413 });
  }

  const idempotencyKey = input.idempotencyKey?.trim();
  if (!idempotencyKey) {
    throw Object.assign(new Error("Idempotency-Key header is required"), { statusCode: 400 });
  }

  const payloadHash = hashMessagePayload(conversationId, content);
  const claim = await claimMessageRequest({
    userId,
    conversationId,
    idempotencyKey,
    payloadHash,
  });

  if (claim.replayed) {
    return {
      ...(await readMessageRequestResult(claim.request)),
      replayed: true,
    };
  }

  const deadlineAt = claim.request.deadlineAt;

  // 1. Fetch a bounded recent history for conversational continuity.
  const previousMessages = await prisma.aIMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { sender: true, content: true },
  });
  // 2. Store exactly one user message for the claimed request. A failed
  // request reuses its original user row on a safe retry.
  let userMessage: any;
  try {
    userMessage = claim.request.userMessageId
      ? await prisma.aIMessage.findUnique({ where: { id: claim.request.userMessageId } })
      : await prisma.aIMessage.create({
          data: { conversationId, sender: "user", content },
        });
    if (!userMessage) {
      throw new Error("The idempotent user message could not be recovered");
    }
    if (!claim.request.userMessageId) {
      await prisma.aIMessageRequest.update({
        where: { id: claim.request.id },
        data: { userMessageId: userMessage.id },
      });
    }
  } catch (error) {
    await failMessageRequest(claim.request.id, "MESSAGE_PERSISTENCE_FAILED");
    throw Object.assign(new Error("Unable to persist the AI message request"), { statusCode: 500, cause: error });
  }

  const historyBeforeMessage = claim.request.userMessageId
    ? previousMessages.filter((message: any) => message.content !== content || message.sender !== "user")
    : previousMessages;
  const conversationHistory = boundConversationHistory(historyBeforeMessage.reverse());

  try {
    ensureTimeRemaining(deadlineAt);

    // 3. Resolve course metadata
    const courseInfo = conversation.course
    ? {
        code: conversation.course.code,
        title: conversation.course.title,
        department: conversation.course.department,
        semester: conversation.course.semester,
      }
    : {
        code: "General",
        title: "Academic Curriculum",
        department: "Computer Engineering",
        semester: 8,
      };

    // Handle greetings and authorized website questions locally. These do not
    // need embeddings or model generation and must never be answered from
    // arbitrary user-provided IDs or model-selected database fields.
    const websiteContext = await resolveWebsiteContext(content, userId, role);
    if (websiteContext) {
      const elapsed = elapsedMs(requestStartedAt);
      const persisted = await persistTutorAnswer({
        conversationId,
        requestId: claim.request.id,
        answer: websiteContext.answer,
        sources: [],
        suggestedFollowUps: websiteContext.suggestedFollowUps,
        deadlineAt,
      });
      return {
        userMessage,
        assistantMessage: persisted.assistantMessage,
        request: publicRequest(persisted.completedRequest),
        timing: {
          embeddingMs: 0,
          vectorSearchMs: 0,
          retrievalMs: 0,
          rawCandidateCount: 0,
          acceptedCandidateCount: 0,
          minSimilarity: DEFAULT_RAG_THRESHOLD,
          retrievalStatus: "no-course-context",
          contextAssemblyMs: 0,
          generationMs: 0,
          totalRoundTripMs: elapsed,
          serverTotalMs: elapsed,
          personalizationAvailable: false,
          personalizationIncluded: false,
          promptChars: 0,
          outputChars: websiteContext.answer.length,
          providerAttemptCount: 0,
          fallbackUsed: false,
          retryCount: 0,
          backoffMs: 0,
        },
        modelUsed: "website-context",
        modelRequested: "website-context",
        providerUsed: "local",
        providerAttempts: [],
        replayed: false,
      };
    }

    // 4. Retrieve sanitized student educational profile (zero PII, weak topics, progress, recs)
    const profileStartedAt = performance.now();
    const studentProfile = role === "STUDENT"
      ? await studentContextService.getStudentEducationalProfile(userId, conversation.courseId || undefined)
      : undefined;
    const profileLoadMs = elapsedMs(profileStartedAt);
    ensureTimeRemaining(deadlineAt);

    // 5. Perform semantic vector RAG retrieval with precise timing
    let retrievedChunks: any[] = [];
    let retrievalTiming: Pick<TutorTiming, "embeddingMs" | "vectorSearchMs" | "retrievalMs" | "rawCandidateCount" | "acceptedCandidateCount" | "minSimilarity" | "retrievalStatus"> = {
    embeddingMs: 0,
    vectorSearchMs: 0,
    retrievalMs: 0,
    rawCandidateCount: 0,
    acceptedCandidateCount: 0,
    minSimilarity: DEFAULT_RAG_THRESHOLD,
    retrievalStatus: "no-course-context",
  };

    if (conversation.courseId) {
      const retrievalStartedAt = performance.now();
      try {
        const retrievalQuery = buildTutorRetrievalQuery(content, conversationHistory);
        const retrievalResult = await ragService.retrieveRelevantChunksWithTiming(retrievalQuery, conversation.courseId);
      retrievedChunks = retrievalResult.chunks;
      retrievalTiming = {
        embeddingMs: retrievalResult.embeddingMs,
        vectorSearchMs: retrievalResult.vectorSearchMs,
        retrievalMs: retrievalResult.retrievalMs ?? retrievalResult.embeddingMs + retrievalResult.vectorSearchMs,
        rawCandidateCount: retrievalResult.rawCandidateCount ?? retrievalResult.chunks.length,
        acceptedCandidateCount: retrievalResult.acceptedCandidateCount ?? retrievalResult.chunks.length,
        minSimilarity: retrievalResult.minSimilarity ?? DEFAULT_RAG_THRESHOLD,
        retrievalStatus: retrievalResult.retrievalStatus ?? (retrievalResult.chunks.length > 0 ? "accepted" : "no-candidates"),
      };
      } catch (retrievalError: any) {
        if (retrievalError?.code === "AI_WORKFLOW_DEADLINE_EXCEEDED") throw retrievalError;
      // Keep failure timing visible instead of replacing it with two zeros.
      // The stage is attached by RAGService and is safe to include in logs.
      const failedTiming = retrievalError?.retrievalTiming;
      retrievalTiming = failedTiming || {
        embeddingMs: elapsedMs(retrievalStartedAt),
        vectorSearchMs: 0,
        retrievalMs: elapsedMs(retrievalStartedAt),
        rawCandidateCount: 0,
        acceptedCandidateCount: 0,
        minSimilarity: DEFAULT_RAG_THRESHOLD,
        retrievalStatus: "vector-search-error",
      };
      console.warn("[RAG RETRIEVAL WARNING] Falling back without retrieved chunks:", {
        stage: retrievalError?.retrievalStage || "unknown",
        statusCode: retrievalError?.statusCode || retrievalError?.status,
        code: retrievalError?.code,
        message: safeErrorMessage(retrievalError),
        retrievalStatus: retrievalTiming.retrievalStatus,
        rawCandidateCount: retrievalTiming.rawCandidateCount,
        acceptedCandidateCount: retrievalTiming.acceptedCandidateCount,
        similarityThreshold: retrievalTiming.minSimilarity,
        retrievalMs: retrievalTiming.retrievalMs,
      });
      }
      ensureTimeRemaining(deadlineAt);
    }

    // 6. Generate adaptive, factually grounded tutor response. The provider
    // receives the remaining workflow budget and owns cancellation of its
    // network attempt; a client disconnect does not cancel this server-side
    // work or make the request retryable while it is still processing.
    ensureTimeRemaining(deadlineAt);
    const remainingGenerationBudgetMs = deadlineAt.getTime() - Date.now();
    if (remainingGenerationBudgetMs < MIN_PROVIDER_REQUEST_BUDGET_MS) {
      throw Object.assign(new Error("AI message workflow deadline leaves insufficient provider time"), {
        statusCode: 504,
        code: "AI_WORKFLOW_DEADLINE_EXCEEDED",
      });
    }
    const ragResult = await ragService.generateGroundedTutorResponse(content, courseInfo, retrievedChunks, {
      studentProfile,
      conversationHistory,
      retrievalTiming,
      allowUngroundedGeneration: !conversation.courseId,
      generationBudgetMs: remainingGenerationBudgetMs,
    });

    // 7. Do not write a result after the deadline. The request row remains so
    // status lookup and a safe failed retry are deterministic.
    ensureTimeRemaining(deadlineAt);

  const rawTiming = (ragResult.timing || {}) as Partial<TutorTiming>;
  const timing: TutorTiming = {
    embeddingMs: rawTiming.embeddingMs ?? retrievalTiming.embeddingMs,
    vectorSearchMs: rawTiming.vectorSearchMs ?? retrievalTiming.vectorSearchMs,
    retrievalMs: rawTiming.retrievalMs ?? retrievalTiming.retrievalMs,
    rawCandidateCount: rawTiming.rawCandidateCount ?? retrievalTiming.rawCandidateCount,
    acceptedCandidateCount: rawTiming.acceptedCandidateCount ?? retrievalTiming.acceptedCandidateCount,
    minSimilarity: rawTiming.minSimilarity ?? retrievalTiming.minSimilarity,
    retrievalStatus: rawTiming.retrievalStatus ?? retrievalTiming.retrievalStatus,
    contextAssemblyMs: rawTiming.contextAssemblyMs ?? 0,
    generationMs: rawTiming.generationMs ?? 0,
    totalRoundTripMs: rawTiming.totalRoundTripMs ?? retrievalTiming.retrievalMs,
    thinkingBudgetUsed: rawTiming.thinkingBudgetUsed,
    serverTotalMs: elapsedMs(requestStartedAt),
    personalizationAvailable: studentProfile?.isAvailable === true,
    personalizationIncluded: studentProfile !== undefined,
    promptChars: rawTiming.promptChars,
    outputChars: rawTiming.outputChars,
    providerAttemptCount: rawTiming.providerAttemptCount,
    fallbackUsed: rawTiming.fallbackUsed,
    retryCount: rawTiming.retryCount,
    backoffMs: rawTiming.backoffMs,
  };

    console.log("[AURA AI TUTOR METRICS]", {
    retrievalMs: timing.retrievalMs,
    rawCandidateCount: timing.rawCandidateCount,
    acceptedChunkCount: timing.acceptedCandidateCount,
    similarityThreshold: timing.minSimilarity,
    contextAssemblyMs: timing.contextAssemblyMs,
    generationMs: timing.generationMs,
    totalMs: timing.serverTotalMs,
    profileLoadMs,
    personalizationAvailable: timing.personalizationAvailable,
    personalizationIncluded: timing.personalizationIncluded,
    retrievalStatus: timing.retrievalStatus,
    promptChars: timing.promptChars,
    outputChars: timing.outputChars,
    providerAttemptCount: timing.providerAttemptCount,
    fallbackUsed: timing.fallbackUsed,
    retryCount: timing.retryCount,
    backoffMs: timing.backoffMs,
  });

    const persisted = await persistTutorAnswer({
      conversationId,
      requestId: claim.request.id,
      answer: ragResult.answer,
      sources: ragResult.sources,
      suggestedFollowUps: ragResult.suggestedFollowUps,
      deadlineAt,
    });

    return {
      userMessage,
      assistantMessage: persisted.assistantMessage,
      request: publicRequest(persisted.completedRequest),
      timing,
      modelUsed: ragResult.modelUsed,
      modelRequested: ragResult.modelRequested,
      providerUsed: ragResult.providerUsed,
      providerAttempts: ragResult.providerAttempts,
      replayed: false,
    };
  } catch (error: any) {
    const isConflict = error?.statusCode === 409;
    await failMessageRequest(claim.request.id, error?.code === "AI_WORKFLOW_DEADLINE_EXCEEDED" ? "AI_WORKFLOW_DEADLINE_EXCEEDED" : isConflict ? "AI_REQUEST_CONFLICT" : "AI_PROVIDER_FAILED");
    if (error?.code === "AI_WORKFLOW_DEADLINE_EXCEEDED") throw error;
    if (isConflict) throw error;
    throw Object.assign(new Error("AI provider failed; retry this idempotency key after the request is marked FAILED"), {
      statusCode: 502,
      code: "AI_PROVIDER_FAILED",
      cause: error,
    });
  }
}

async function persistTutorAnswer(input: {
  conversationId: string;
  requestId: string;
  answer: string;
  sources: any[];
  suggestedFollowUps: string[];
  deadlineAt: Date;
}) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.aIMessageRequest.findUnique({ where: { id: input.requestId } });
    if (!current || current.status !== "PROCESSING") {
      throw Object.assign(new Error("The AI message request is no longer processing"), { statusCode: 409 });
    }
    ensureTimeRemaining(input.deadlineAt);
    const assistantMessage = await tx.aIMessage.create({
      data: {
        conversationId: input.conversationId,
        sender: "assistant",
        content: input.answer,
        sources: input.sources,
        suggestedFollowUps: input.suggestedFollowUps,
      },
    });
    ensureTimeRemaining(input.deadlineAt);
    await tx.aIConversation.update({ where: { id: input.conversationId }, data: { updatedAt: new Date() } });
    ensureTimeRemaining(input.deadlineAt);
    const completedRequest = await tx.aIMessageRequest.update({
      where: { id: input.requestId },
      data: { status: "COMPLETED", assistantMessageId: assistantMessage.id, completedAt: new Date(), errorCode: null, errorMessage: null },
    });
    return { assistantMessage, completedRequest };
  });
}

type MessageRequestRecord = any;

async function claimMessageRequest(input: {
  userId: string;
  conversationId: string;
  idempotencyKey: string;
  payloadHash: string;
}): Promise<{ request: MessageRequestRecord; replayed: boolean }> {
  const deadlineAt = new Date(Date.now() + workflowDeadlineMs());
  let request: MessageRequestRecord;
  try {
    request = await prisma.aIMessageRequest.create({
      data: { ...input, deadlineAt, status: "PROCESSING" },
    });
    return { request, replayed: false };
  } catch (error: any) {
    if (error?.code !== "P2002") throw error;
    request = await prisma.aIMessageRequest.findUnique({
      where: { userId_idempotencyKey: { userId: input.userId, idempotencyKey: input.idempotencyKey } },
    });
    if (!request) throw error;
  }

  if (request.conversationId !== input.conversationId || request.payloadHash !== input.payloadHash) {
    throw Object.assign(new Error("Idempotency key is already bound to a different AI message request"), { statusCode: 409, code: "AI_IDEMPOTENCY_MISMATCH" });
  }
  if (request.status === "COMPLETED") return { request, replayed: true };
  if (request.status === "PROCESSING") {
    throw Object.assign(new Error("An AI message with this idempotency key is already processing"), { statusCode: 409, code: "AI_REQUEST_PROCESSING" });
  }

  // A failed request may be retried, but PROCESSING is never reclaimed based
  // on age: stale active work must be observed or reconciled explicitly.
  const claimed = await prisma.aIMessageRequest.updateMany({
    where: { id: request.id, status: "FAILED" },
    data: { status: "PROCESSING", startedAt: new Date(), deadlineAt, failedAt: null, errorCode: null, errorMessage: null },
  });
  if (claimed.count !== 1) {
    throw Object.assign(new Error("An AI message with this idempotency key is already processing"), { statusCode: 409, code: "AI_REQUEST_PROCESSING" });
  }
  request = await prisma.aIMessageRequest.findUniqueOrThrow({ where: { id: request.id } });
  return { request, replayed: false };
}

async function readMessageRequestResult(request: MessageRequestRecord) {
  const assistantMessage = request.assistantMessageId
    ? await prisma.aIMessage.findUnique({ where: { id: request.assistantMessageId } })
    : null;
  const userMessage = request.userMessageId
    ? await prisma.aIMessage.findUnique({ where: { id: request.userMessageId } })
    : null;
  return { userMessage, assistantMessage, request: publicRequest(request), timing: undefined };
}

export async function getAIMessageRequest(conversationId: string, idempotencyKey: string, userId: string, role: string) {
  const conversation = await prisma.aIConversation.findUnique({ where: { id: conversationId } });
  if (!conversation) throw Object.assign(new Error("Conversation not found"), { statusCode: 404 });
  if (conversation.userId !== userId) throw Object.assign(new Error("Forbidden: Access denied to this conversation"), { statusCode: 403 });
  await authorizeCourseConversation(userId, role, conversation.courseId);
  const request = await prisma.aIMessageRequest.findUnique({
    where: { userId_idempotencyKey: { userId, idempotencyKey } },
  });
  if (!request || request.conversationId !== conversationId) {
    throw Object.assign(new Error("AI message request not found"), { statusCode: 404 });
  }
  return readMessageRequestResult(request);
}

async function failMessageRequest(id: string, code: string): Promise<void> {
  await prisma.aIMessageRequest.updateMany({
    where: { id, status: "PROCESSING" },
    data: { status: "FAILED", failedAt: new Date(), errorCode: code, errorMessage: publicFailureMessage(code) },
  }).catch(() => undefined);
}

function publicRequest(request: MessageRequestRecord) {
  return {
    id: request.id,
    status: request.status,
    idempotencyKey: request.idempotencyKey,
    conversationId: request.conversationId,
    deadlineAt: request.deadlineAt,
    startedAt: request.startedAt,
    completedAt: request.completedAt,
    failedAt: request.failedAt,
    errorCode: request.errorCode,
    errorMessage: request.errorMessage,
  };
}

function hashMessagePayload(conversationId: string, content: string): string {
  return createHash("sha256").update(JSON.stringify({ conversationId, content })).digest("hex");
}

function workflowDeadlineMs(): number {
  const configured = Number(process.env.AI_MESSAGE_WORKFLOW_TIMEOUT_MS);
  return Number.isFinite(configured) && configured >= 1000 && configured <= 10 * 60 * 1000 ? Math.round(configured) : 120000;
}

function ensureTimeRemaining(deadlineAt: Date): void {
  if (deadlineAt.getTime() <= Date.now()) {
    throw Object.assign(new Error("AI message workflow deadline exceeded"), { statusCode: 504, code: "AI_WORKFLOW_DEADLINE_EXCEEDED" });
  }
}

function publicFailureMessage(code: string): string {
  return code === "AI_WORKFLOW_DEADLINE_EXCEEDED"
    ? "The AI message workflow timed out before completion."
    : code === "AI_PROVIDER_FAILED"
      ? "The AI provider failed before the message was completed."
      : "The AI message request failed before completion.";
}

function elapsedMs(startTime: number): number {
  const elapsed = performance.now() - startTime;
  return elapsed > 0 ? Math.max(1, Math.round(elapsed)) : 0;
}

function boundConversationHistory(
  messages: Array<{ sender: string; content: string }>
): Array<{ sender: string; content: string }> {
  const bounded: Array<{ sender: string; content: string }> = [];
  let remaining = MAX_HISTORY_CHARS;

  for (let index = messages.length - 1; index >= 0 && remaining > 0; index -= 1) {
    const message = messages[index];
    const content = message.content.slice(0, remaining);
    bounded.unshift({ sender: message.sender, content });
    remaining -= content.length;
  }

  return bounded;
}

/**
 * Resolve short follow-up references before semantic retrieval. The current
 * question remains first and authoritative; recent student questions only
 * supply missing topic terms for queries such as "example of Unit 2?".
 */
export function buildTutorRetrievalQuery(
  question: string,
  conversationHistory: Array<{ sender: string; content: string }>
): string {
  const normalizedQuestion = question.slice(0, MAX_MESSAGE_CHARS).trim();
  const needsHistory = /\b(this|that|it|these|those|above|previous|earlier|unit\s*\d+|step[-\s]?by[-\s]?step|example|further|continue)\b/i.test(
    normalizedQuestion
  );
  if (!needsHistory) return normalizedQuestion;

  const priorStudentQuestions = conversationHistory
    .filter((message) => message.sender === "user")
    .slice(-2)
    .map((message) => message.content.trim())
    .filter(Boolean);
  if (priorStudentQuestions.length === 0) return normalizedQuestion;

  const historyBlock = priorStudentQuestions.join("\n");
  const availableHistoryChars = Math.max(0, MAX_MESSAGE_CHARS - normalizedQuestion.length - 34);
  if (availableHistoryChars === 0) return normalizedQuestion;

  return `${normalizedQuestion}\nRelated prior student questions:\n${historyBlock.slice(0, availableHistoryChars)}`;
}

function safeErrorMessage(error: any): string {
  return String(error?.message || error || "Unknown error")
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[REDACTED_KEY]")
    .replace(/[A-Za-z0-9_-]{35,}/g, "[REDACTED_TOKEN]")
    .slice(0, 2000);
}
