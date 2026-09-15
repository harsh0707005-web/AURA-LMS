import prisma from "../lib/prisma.js";
import { CreateAIConversationInput, PostAIMessageInput } from "../types/academic.types.js";
import { ragService } from "./ai/rag.service.js";
import { studentContextService } from "./ai/student-context.service.js";

export async function getUserConversations(userId: string) {
  return await prisma.aIConversation.findMany({
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
}

export async function getConversationById(conversationId: string, userId: string) {
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

  return conversation;
}

export async function createConversation(userId: string, input: CreateAIConversationInput) {
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

export async function deleteConversation(conversationId: string, userId: string) {
  const conversation = await prisma.aIConversation.findUnique({ where: { id: conversationId } });
  if (!conversation) {
    throw Object.assign(new Error("Conversation not found"), { statusCode: 404 });
  }

  if (conversation.userId !== userId) {
    throw Object.assign(new Error("Forbidden: Access denied to this conversation"), { statusCode: 403 });
  }

  await prisma.aIConversation.delete({ where: { id: conversationId } });
  return { message: "Conversation deleted successfully" };
}

export async function postMessageToConversation(
  conversationId: string,
  userId: string,
  input: PostAIMessageInput
) {
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

  const { content } = input;
  if (!content || content.trim() === "") {
    throw Object.assign(new Error("Message content cannot be empty"), { statusCode: 400 });
  }

  // 1. Fetch prior conversation history for conversational continuity (last 5 messages)
  const previousMessages = await prisma.aIMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { sender: true, content: true },
  });
  const conversationHistory = previousMessages.reverse();

  // 2. Store user message in PostgreSQL
  const userMessage = await prisma.aIMessage.create({
    data: {
      conversationId,
      sender: "user",
      content: content.trim(),
    },
  });

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

  // 4. Retrieve sanitized student educational profile (zero PII, weak topics, progress, recs)
  const studentProfile = await studentContextService.getStudentEducationalProfile(
    userId,
    conversation.courseId || undefined
  );

  // 5. Perform semantic vector RAG retrieval with precise timing
  let retrievedChunks: any[] = [];
  let retrievalTiming = { embeddingMs: 0, vectorSearchMs: 0 };

  if (conversation.courseId) {
    try {
      const retrievalResult = await ragService.retrieveRelevantChunksWithTiming(
        content.trim(),
        conversation.courseId
      );
      retrievedChunks = retrievalResult.chunks;
      retrievalTiming = {
        embeddingMs: retrievalResult.embeddingMs,
        vectorSearchMs: retrievalResult.vectorSearchMs,
      };
    } catch (retrievalError) {
      console.warn("[RAG RETRIEVAL WARNING] Vector search encountered an issue, falling back:", retrievalError);
    }
  }

  // 6. Generate adaptive, factually grounded tutor response
  let ragResult;
  try {
    ragResult = await ragService.generateGroundedTutorResponse(content.trim(), courseInfo, retrievedChunks, {
      studentProfile,
      conversationHistory,
      retrievalTiming,
    });
  } catch (genError: any) {
    console.error("[GEMINI GENERATION ERROR]:", genError?.message || genError);
    // Graceful fallback response if all LLM candidates fail
    ragResult = {
      answer:
        `Regarding "${content.trim()}" in ${courseInfo.code} (${courseInfo.title}):\n\n` +
        (retrievedChunks.length > 0
          ? `Based on ${retrievedChunks[0].documentName} (${retrievedChunks[0].unit}):\n${retrievedChunks[0].content.slice(0, 250)}...`
          : "Please consult the course syllabus and uploaded lecture notes for this topic."),
      sources: retrievedChunks.map((c) => ({
        documentName: c.documentName,
        materialId: c.materialId,
        unit: c.unit,
        page: c.pageNumber,
        chunkId: c.chunkId,
        score: Number(c.similarity.toFixed(3)),
        excerpt: c.content.length > 180 ? `${c.content.slice(0, 180)}...` : c.content,
      })),
      suggestedFollowUps: [
        `What are the core topics for ${courseInfo.code}?`,
        `Can you provide an examination breakdown for this unit?`,
      ],
      isGrounded: retrievedChunks.length > 0,
      timing: {
        embeddingMs: retrievalTiming.embeddingMs,
        vectorSearchMs: retrievalTiming.vectorSearchMs,
        contextAssemblyMs: 0,
        generationMs: 0,
        totalRoundTripMs: retrievalTiming.embeddingMs + retrievalTiming.vectorSearchMs,
      },
    };
  }

  // 7. Persist assistant message with verified sources, follow-ups, and timing in PostgreSQL
  const assistantMessage = await prisma.aIMessage.create({
    data: {
      conversationId,
      sender: "assistant",
      content: ragResult.answer,
      sources: ragResult.sources,
      suggestedFollowUps: ragResult.suggestedFollowUps,
    },
  });

  // 8. Update conversation timestamp
  await prisma.aIConversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  return {
    userMessage,
    assistantMessage,
    timing: ragResult.timing,
    modelUsed: ragResult.modelUsed,
  };
}
