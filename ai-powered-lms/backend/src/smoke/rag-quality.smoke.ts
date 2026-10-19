import assert from "node:assert/strict";
import test from "node:test";
import prisma from "../lib/prisma.js";
import { embeddingService } from "../services/ai/embedding.service.js";
import { ragService } from "../services/ai/rag.service.js";
import { providerRegistry } from "../services/ai/providers/provider.registry.js";

const vector = Array.from({ length: 3072 }, () => 0.01);

function replace(target: any, method: string, implementation: (...args: any[]) => any, t: any) {
  const original = target[method];
  target[method] = implementation;
  t.after(() => {
    target[method] = original;
  });
}

test("RAG distinguishes accepted chunks from threshold filtering and filters non-ready materials", async (t) => {
  replace(embeddingService, "embedText", async () => vector, t);
  let sql = "";
  replace(prisma, "$queryRawUnsafe", async (query: string) => {
    sql = query;
    return [
      { chunkId: "accepted", materialId: "m1", documentName: "Ready.pdf", unit: "Unit 1", pageNumber: 2, content: "grounded", tokenCount: 2, distance: 0.1, similarity: 0.9 },
      { chunkId: "rejected", materialId: "m2", documentName: "Ready.pdf", unit: "Unit 1", pageNumber: 3, content: "weak", tokenCount: 2, distance: 0.7, similarity: 0.3 },
    ];
  }, t);

  const accepted = await ragService.retrieveRelevantChunksWithTiming("question", "course-a", { minSimilarity: 0.55 });
  assert.equal(accepted.rawCandidateCount, 2);
  assert.equal(accepted.acceptedCandidateCount, 1);
  assert.equal(accepted.retrievalStatus, "accepted");
  assert.match(sql, /processingStatus/);
  assert.match(sql, /m\."courseId"/);

  replace(prisma, "$queryRawUnsafe", async () => [], t);
  const empty = await ragService.retrieveRelevantChunksWithTiming("question", "course-a");
  assert.equal(empty.retrievalStatus, "no-candidates");
  assert.equal(empty.acceptedCandidateCount, 0);
});

test("RAG prompt preserves citations and bounds untrusted context/history", async (t) => {
  const prompts: string[] = [];
  const fakeProvider = {
    providerId: "test",
    modelName: "test-model",
    generateCompletion: async (prompt: string) => {
      prompts.push(prompt);
      return { text: "grounded answer", model: "test-model", durationMs: 2 };
    },
  };
  providerRegistry.registerProvider(fakeProvider as any);
  const previous = process.env.DEFAULT_LLM_PROVIDER;
  providerRegistry.setDefaultProviderId("test");
  t.after(() => {
    if (previous) providerRegistry.setDefaultProviderId(previous);
    else providerRegistry.setDefaultProviderId("gemini");
  });

  const result = await ragService.generateGroundedTutorResponse(
    "Explain the concept",
    { code: "CS-A", title: "Course A" },
    [{
      chunkId: "chunk-1",
      materialId: "material-1",
      documentName: "Lecture.pdf",
      unit: "Unit 1",
      pageNumber: 4,
      content: "A".repeat(20000),
      tokenCount: 5000,
      similarity: 0.91,
      distance: 0.09,
    }],
    {
      conversationHistory: [{ sender: "user", content: "B".repeat(20000) }],
      retrievalTiming: {
        embeddingMs: 3,
        vectorSearchMs: 4,
        retrievalMs: 7,
        rawCandidateCount: 1,
        acceptedCandidateCount: 1,
        minSimilarity: 0.55,
        retrievalStatus: "accepted",
      },
    }
  );

  assert.equal(result.isGrounded, true);
  assert.equal(result.sources[0].documentName, "Lecture.pdf");
  assert.equal(result.sources[0].page, 4);
  assert.ok(prompts[0].length < 25000);
  assert.match(prompts[0], /<retrieved_course_documents>/);
  assert.match(prompts[0], /<conversation_history>/);
});

test("course-bound empty retrieval returns a local refusal without an LLM call", async (t) => {
  let providerCalls = 0;
  const fakeProvider = {
    providerId: "no-context-test",
    modelName: "no-context-test",
    generateCompletion: async () => {
      providerCalls += 1;
      return { text: "should not be called", model: "no-context-test", durationMs: 1 };
    },
  };
  providerRegistry.registerProvider(fakeProvider as any);
  providerRegistry.setDefaultProviderId("no-context-test");
  t.after(() => providerRegistry.setDefaultProviderId("gemini"));

  const result = await ragService.generateGroundedTutorResponse(
    "An unrelated question",
    { code: "CS-A", title: "Course A" },
    [],
    {
      allowUngroundedGeneration: false,
      retrievalTiming: {
        embeddingMs: 2,
        vectorSearchMs: 3,
        retrievalMs: 5,
        rawCandidateCount: 5,
        acceptedCandidateCount: 0,
        minSimilarity: 0.55,
        retrievalStatus: "below-threshold",
      },
    }
  );

  assert.equal(providerCalls, 0);
  assert.equal(result.isGrounded, false);
  assert.equal(result.timing?.generationMs, 0);
  assert.equal(result.timing?.retrievalStatus, "below-threshold");
  assert.match(result.answer, /couldn't find enough relevant material/i);
});
