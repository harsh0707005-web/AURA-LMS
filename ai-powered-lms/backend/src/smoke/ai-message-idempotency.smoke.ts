import assert from "node:assert/strict";
import test from "node:test";
import prisma from "../lib/prisma.js";
import { postMessageToConversation, getAIMessageRequest } from "../services/ai.service.js";
import { ragService } from "../services/ai/rag.service.js";
import { studentContextService } from "../services/ai/student-context.service.js";

type RequestRecord = any;

function installFakeAIStore(t: test.TestContext) {
  const requests = new Map<string, RequestRecord>();
  const messages = new Map<string, any>();
  let sequence = 0;
  const original: Array<[any, string, any]> = [];
  const replace = (target: any, method: string, implementation: (...args: any[]) => any) => {
    original.push([target, method, target[method]]);
    target[method] = implementation;
  };
  const requestKey = (userId: string, idempotencyKey: string) => `${userId}:${idempotencyKey}`;
  const conversation = { id: "conversation-1", userId: "user-1", courseId: null, course: null };

  replace(prisma.aIConversation, "findUnique", async ({ where }: any) => ({ ...conversation, id: where.id }));
  replace(prisma.aIConversation, "update", async () => conversation);
  replace(prisma.aIMessage, "findMany", async () => [...messages.values()].filter((message) => message.conversationId === conversation.id).map((message) => ({ sender: message.sender, content: message.content })));
  replace(prisma.aIMessage, "findUnique", async ({ where }: any) => [...messages.values()].find((message) => message.id === where.id) || null);
  replace(prisma.aIMessage, "create", async ({ data }: any) => {
    const message = { ...data, id: `message-${++sequence}`, createdAt: new Date() };
    messages.set(message.id, message);
    return message;
  });
  replace(prisma.aIMessageRequest, "create", async ({ data }: any) => {
    const key = requestKey(data.userId, data.idempotencyKey);
    if (requests.has(key)) throw Object.assign(new Error("unique"), { code: "P2002" });
    const request = { ...data, id: `request-${++sequence}`, createdAt: new Date(), updatedAt: new Date(), completedAt: null, failedAt: null, userMessageId: null, assistantMessageId: null, errorCode: null, errorMessage: null };
    requests.set(key, request);
    return request;
  });
  replace(prisma.aIMessageRequest, "findUnique", async ({ where }: any) => {
    if (where.id) return [...requests.values()].find((request) => request.id === where.id) || null;
    return requests.get(requestKey(where.userId_idempotencyKey.userId, where.userId_idempotencyKey.idempotencyKey)) || null;
  });
  replace(prisma.aIMessageRequest, "findUniqueOrThrow", async ({ where }: any) => {
    const request = [...requests.values()].find((candidate) => candidate.id === where.id);
    if (!request) throw new Error("not found");
    return request;
  });
  replace(prisma.aIMessageRequest, "update", async ({ where, data }: any) => {
    const request = [...requests.values()].find((candidate) => candidate.id === where.id);
    Object.assign(request, data);
    return request;
  });
  replace(prisma.aIMessageRequest, "updateMany", async ({ where, data }: any) => {
    const request = [...requests.values()].find((candidate) => candidate.id === where.id && candidate.status === where.status);
    if (!request) return { count: 0 };
    Object.assign(request, data);
    return { count: 1 };
  });
  replace(prisma, "$transaction", async (callback: any) => callback(prisma));
  replace(studentContextService, "getStudentEducationalProfile", async () => ({ isAvailable: false, pedagogicalPromptSnippet: "" }));

  t.after(() => {
    for (const [target, method, implementation] of original.reverse()) target[method] = implementation;
  });
  return { requests, messages };
}

test("AI messages are concurrency-safe and replay completed results", async (t) => {
  const store = installFakeAIStore(t);
  let generationCount = 0;
  const originalGeneration = ragService.generateGroundedTutorResponse;
  ragService.generateGroundedTutorResponse = async () => {
    generationCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 15));
    return { answer: "Answer", sources: [], suggestedFollowUps: [], isGrounded: false };
  };
  t.after(() => { ragService.generateGroundedTutorResponse = originalGeneration; });

  const [first, second] = await Promise.allSettled([
    postMessageToConversation("conversation-1", "user-1", "STUDENT", { content: "Explain consensus", idempotencyKey: "same-key" }),
    postMessageToConversation("conversation-1", "user-1", "STUDENT", { content: "Explain consensus", idempotencyKey: "same-key" }),
  ]);
  assert.equal(first.status, "fulfilled");
  assert.equal(second.status, "rejected");
  assert.equal((second as PromiseRejectedResult).reason.statusCode, 409);
  assert.equal(generationCount, 1);

  const replay = await postMessageToConversation("conversation-1", "user-1", "STUDENT", { content: "Explain consensus", idempotencyKey: "same-key" });
  assert.equal(replay.replayed, true);
  assert.equal(replay.assistantMessage?.content, "Answer");
  assert.equal(generationCount, 1);
  assert.equal(store.messages.size, 2);
  const lookup = await getAIMessageRequest("conversation-1", "same-key", "user-1", "STUDENT");
  assert.equal(lookup.request.status, "COMPLETED");
  assert.equal(lookup.assistantMessage?.content, "Answer");
});

test("AI idempotency rejects payload mismatch and protects status lookup ownership", async (t) => {
  installFakeAIStore(t);
  const originalGeneration = ragService.generateGroundedTutorResponse;
  ragService.generateGroundedTutorResponse = async () => ({ answer: "Answer", sources: [], suggestedFollowUps: [], isGrounded: false });
  t.after(() => { ragService.generateGroundedTutorResponse = originalGeneration; });

  await postMessageToConversation("conversation-1", "user-1", "STUDENT", { content: "First", idempotencyKey: "collision-key" });
  await assert.rejects(
    postMessageToConversation("conversation-1", "user-1", "STUDENT", { content: "Different", idempotencyKey: "collision-key" }),
    { statusCode: 409 }
  );
  await assert.rejects(
    postMessageToConversation("conversation-2", "user-1", "STUDENT", { content: "First", idempotencyKey: "collision-key" }),
    { statusCode: 409 }
  );
  await assert.rejects(getAIMessageRequest("conversation-1", "collision-key", "other-user", "STUDENT"), { statusCode: 403 });
});

test("provider failure is FAILED and only FAILED requests can retry", async (t) => {
  const store = installFakeAIStore(t);
  let shouldFail = true;
  const originalGeneration = ragService.generateGroundedTutorResponse;
  ragService.generateGroundedTutorResponse = async () => {
    if (shouldFail) throw new Error("provider unavailable");
    return { answer: "Recovered", sources: [], suggestedFollowUps: [], isGrounded: false };
  };
  t.after(() => { ragService.generateGroundedTutorResponse = originalGeneration; });

  await assert.rejects(
    postMessageToConversation("conversation-1", "user-1", "STUDENT", { content: "Retry me", idempotencyKey: "retry-key" }),
    { statusCode: 502 }
  );
  const failed = store.requests.get("user-1:retry-key");
  assert.equal(failed.status, "FAILED");
  shouldFail = false;
  const retried = await postMessageToConversation("conversation-1", "user-1", "STUDENT", { content: "Retry me", idempotencyKey: "retry-key" });
  assert.equal(retried.request.status, "COMPLETED");
  assert.equal(store.messages.size, 2);

  const stale = await (async () => {
    const request = store.requests.get("user-1:retry-key");
    request.status = "PROCESSING";
    request.deadlineAt = new Date(Date.now() - 60_000);
    return request;
  })();
  assert.equal(stale.status, "PROCESSING");
  await assert.rejects(
    postMessageToConversation("conversation-1", "user-1", "STUDENT", { content: "Retry me", idempotencyKey: "retry-key" }),
    { statusCode: 409 }
  );
});
