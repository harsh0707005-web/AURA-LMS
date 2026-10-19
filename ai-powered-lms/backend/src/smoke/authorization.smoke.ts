import assert from "node:assert/strict";
import test from "node:test";
import { validateQuizAnswers } from "../services/quiz.service.js";
import { embeddingService } from "../services/ai/embedding.service.js";
import { geminiProvider } from "../services/ai/gemini.provider.js";
import { errorHandler } from "../middleware/error.middleware.js";
import attemptRouter from "../routes/attempt.routes.js";

test("quiz answer validation rejects foreign, duplicate, and invalid option answers", () => {
  const questions = [{ id: "q1", options: ["A", "B"] }];
  assert.doesNotThrow(() => validateQuizAnswers(questions, [{ questionId: "q1", selectedOptionIndex: 0 }]));
  for (const answers of [[{ questionId: "foreign", selectedOptionIndex: 0 }], [{ questionId: "q1", selectedOptionIndex: 2 }], [{ questionId: "q1", selectedOptionIndex: -1 }], [{ questionId: "q1", selectedOptionIndex: 0 }, { questionId: "q1", selectedOptionIndex: 1 }]]) assert.throws(() => validateQuizAnswers(questions, answers), { statusCode: 400 });
});

test("legacy submit route rejects unauthenticated and non-student requests", () => {
  const route = (attemptRouter as any).stack.find((layer: any) => layer.route?.path === "/:id/submit").route;
  const res = { statusCode: 200, status(n: number) { this.statusCode = n; return this; }, json() {} };
  let nextCalls = 0;
  route.stack[0].handle({ headers: {} }, res, () => nextCalls++);
  assert.equal(res.statusCode, 401);
  for (const role of ["FACULTY", "ADMIN"]) route.stack[1].handle({ user: { role } }, res, () => nextCalls++);
  assert.equal(res.statusCode, 403);
  route.stack[1].handle({ user: { role: "STUDENT" } }, res, () => nextCalls++);
  assert.equal(nextCalls, 1);
});

test("embedding dimensions fail with a structured error", async (t) => {
  const provider = t.mock.method(geminiProvider, "embedText", async () => Array(3072).fill(0));
  assert.equal((await embeddingService.embedText("valid")).length, 3072);
  provider.mock.mockImplementation(async () => Array(768).fill(0));
  const expected = { code: "EMBEDDING_DIMENSION_MISMATCH", statusCode: 502, details: { expected: 3072, actual: 768 } };
  await assert.rejects(embeddingService.embedText("invalid"), expected);
  assert.throws(() => embeddingService.toVectorLiteral(Array(768).fill(0)), expected);
  const res = { statusCode: 0, body: undefined as any, status(n: number) { this.statusCode = n; return this; }, json(body: any) { this.body = body; } };
  errorHandler(Object.assign(new Error("bad dimension"), expected), {} as any, res as any, () => {});
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.code, "EMBEDDING_DIMENSION_MISMATCH");
});
