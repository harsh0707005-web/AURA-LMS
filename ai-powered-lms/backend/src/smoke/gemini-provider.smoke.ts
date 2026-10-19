import assert from "node:assert/strict";
import test from "node:test";

process.env.GEMINI_API_KEY = "test-key-not-used";
process.env.GEMINI_GENERATION_MODEL = "configured-model";
process.env.GEMINI_FALLBACK_MODELS = "fallback-model";
process.env.GEMINI_THINKING_BUDGET = "0";
process.env.GEMINI_MAX_ATTEMPTS_PER_MODEL = "2";
process.env.GEMINI_MAX_TOTAL_ATTEMPTS = "4";

const { GeminiProvider } = await import("../services/ai/gemini.provider.js");

function providerWith(fakeGenerateContent: (request: any) => Promise<any>) {
  const provider = new GeminiProvider();
  (provider as any).ai = { models: { generateContent: fakeGenerateContent } };
  return provider;
}

test("omits thinkingConfig when the configured thinking budget is zero", async () => {
  const requests: any[] = [];
  const provider = providerWith(async (request) => {
    requests.push(request);
    return { text: "valid answer", usageMetadata: { totalTokenCount: 3 } };
  });

  const result = await provider.generateCompletion("Explain vectors");

  assert.equal(result.text, "valid answer");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].model, "configured-model");
  assert.equal("thinkingConfig" in requests[0].config, false);
  assert.equal(requests[0].config.httpOptions.timeout > 0, true);
  assert.ok(requests[0].config.abortSignal);
  assert.equal(result.requestedModel, "configured-model");
  assert.equal(result.fallbackUsed, false);
  assert.equal(result.promptChars, "Explain vectors".length);
});

test("preserves sanitized INVALID_ARGUMENT details after all candidates fail", async () => {
  const provider = providerWith(async () => {
    throw Object.assign(new Error("Request contains an invalid argument"), {
      status: 400,
      code: "INVALID_ARGUMENT",
      details: [{ fieldViolations: [{ field: "generationConfig.thinkingConfig" }] }],
    });
  });

  await assert.rejects(provider.generateCompletion("Explain vectors"), (error: any) => {
    assert.equal(error.statusCode, 400);
    assert.equal(error.code, "INVALID_ARGUMENT");
    assert.match(error.message, /INVALID_ARGUMENT/);
    assert.match(error.message, /thinkingConfig/);
    assert.equal(error.details.attempts.length, 1);
    return true;
  });
});

test("falls through a transient primary-model failure to a compatible fallback", async () => {
  const models: string[] = [];
  const provider = providerWith(async (request) => {
    models.push(request.model);
    if (request.model === "configured-model") {
      throw Object.assign(new Error("temporarily unavailable"), { status: 503, code: "UNAVAILABLE" });
    }
    return { text: "fallback answer" };
  });

  const result = await provider.generateCompletion("Explain vectors");

  assert.equal(result.model, "fallback-model");
  assert.deepEqual(models, ["configured-model", "configured-model", "fallback-model"]);
  assert.equal(result.requestedModel, "configured-model");
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.attempts?.filter((attempt) => attempt.outcome === "error").length, 2);
});

test("bounds a stalled Gemini request and records the timeout without leaking prompt data", async () => {
  const previousTimeout = process.env.GEMINI_REQUEST_TIMEOUT_MS;
  const previousBudget = process.env.GEMINI_GENERATION_BUDGET_MS;
  process.env.GEMINI_REQUEST_TIMEOUT_MS = "10";
  process.env.GEMINI_GENERATION_BUDGET_MS = "25";

  try {
    const provider = providerWith(async (request) => await new Promise((_resolve, reject) => {
      request.config.abortSignal.addEventListener("abort", () => {
        reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
      });
    }));

    await assert.rejects(provider.generateCompletion("private prompt content"), (error: any) => {
      assert.equal(error.statusCode, 504);
      assert.equal(error.code, "GEMINI_GENERATION_TIMEOUT");
      assert.equal(error.details.attempts.length, 1);
      assert.equal(error.details.attempts[0].error.includes("private prompt content"), false);
      return true;
    });
  } finally {
    if (previousTimeout === undefined) delete process.env.GEMINI_REQUEST_TIMEOUT_MS;
    else process.env.GEMINI_REQUEST_TIMEOUT_MS = previousTimeout;
    if (previousBudget === undefined) delete process.env.GEMINI_GENERATION_BUDGET_MS;
    else process.env.GEMINI_GENERATION_BUDGET_MS = previousBudget;
  }
});
