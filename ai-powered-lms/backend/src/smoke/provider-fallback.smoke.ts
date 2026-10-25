import assert from "node:assert/strict";
import test from "node:test";
import { providerRegistry } from "../services/ai/providers/provider.registry.js";
import { LLMProvider } from "../services/ai/providers/llm-provider.interface.js";

function provider(
  providerId: string,
  modelName: string,
  generateCompletion: LLMProvider["generateCompletion"]
): LLMProvider {
  return { providerId, modelName, generateCompletion };
}

function installProviders(
  t: any,
  gemini: LLMProvider,
  groq: LLMProvider,
  groqKey?: string
): void {
  const originalGemini = providerRegistry.getProvider("gemini");
  const previousDefault = providerRegistry.getDefaultProviderId();
  const previousGroqKey = process.env.GROQ_API_KEY;

  providerRegistry.registerProvider(gemini);
  providerRegistry.registerProvider(groq);
  providerRegistry.setDefaultProviderId("gemini");
  if (groqKey === undefined) delete process.env.GROQ_API_KEY;
  else process.env.GROQ_API_KEY = groqKey;

  t.after(() => {
    providerRegistry.registerProvider(originalGemini);
    providerRegistry.setDefaultProviderId(previousDefault);
    if (previousGroqKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = previousGroqKey;
  });
}

test("keeps Gemini as the responder when Gemini succeeds", async (t) => {
  let groqCalls = 0;
  installProviders(
    t,
    provider("gemini", "gemini-primary", async () => ({
      text: "Gemini answer",
      model: "gemini-primary",
      durationMs: 4,
      fallbackUsed: false,
      attempts: [{ model: "gemini-primary", attempt: 1, outcome: "success", durationMs: 4 }],
    })),
    provider("groq", "groq-fallback", async () => {
      groqCalls += 1;
      return { text: "unexpected", model: "groq-fallback", durationMs: 1 };
    }),
    "test-groq-key"
  );

  const generated = await providerRegistry.generateWithFallback("same grounded prompt");

  assert.equal(generated.provider.providerId, "gemini");
  assert.equal(generated.result.text, "Gemini answer");
  assert.equal(generated.result.fallbackUsed, false);
  assert.equal(groqCalls, 0);
  assert.equal(generated.result.attempts?.[0].providerId, "gemini");
});

test("falls back to Groq after Gemini fails and preserves the grounded prompt", async (t) => {
  const calls: string[] = [];
  let fallbackOptions: any;
  installProviders(
    t,
    provider("gemini", "gemini-primary", async (prompt) => {
      calls.push(`gemini:${prompt}`);
      throw Object.assign(new Error("Gemini timed out"), {
        statusCode: 504,
        code: "GEMINI_GENERATION_TIMEOUT",
        details: {
          attempts: [{ model: "gemini-primary", attempt: 1, outcome: "error", durationMs: 20, status: 504 }],
          retryCount: 0,
          backoffMs: 0,
        },
      });
    }),
    provider("groq", "groq-fallback", async (prompt, options) => {
      calls.push(`groq:${prompt}`);
      fallbackOptions = options;
      return {
        text: "Groq answer",
        model: "groq-fallback",
        durationMs: 8,
        attempts: [{ model: "groq-fallback", attempt: 1, outcome: "success", durationMs: 8 }],
      };
    }),
    "test-groq-key"
  );

  const generated = await providerRegistry.generateWithFallback("same grounded prompt", {
    generationBudgetMs: 5_000,
    requestTimeoutMs: 5_000,
  });

  assert.deepEqual(calls, ["gemini:same grounded prompt", "groq:same grounded prompt"]);
  assert.equal(generated.provider.providerId, "groq");
  assert.equal(generated.result.requestedModel, "gemini-primary");
  assert.equal(generated.result.model, "groq-fallback");
  assert.equal(generated.result.fallbackUsed, true);
  assert.ok(fallbackOptions.generationBudgetMs > 0 && fallbackOptions.generationBudgetMs <= 5_000);
  assert.deepEqual(generated.result.attempts?.map((attempt) => attempt.providerId), ["gemini", "groq"]);
});

test("does not call Groq when its key is not configured", async (t) => {
  let groqCalls = 0;
  const primaryError = Object.assign(new Error("Gemini failed"), { statusCode: 503, code: "UNAVAILABLE" });
  installProviders(
    t,
    provider("gemini", "gemini-primary", async () => { throw primaryError; }),
    provider("groq", "groq-fallback", async () => {
      groqCalls += 1;
      return { text: "unexpected", model: "groq-fallback", durationMs: 1 };
    })
  );

  await assert.rejects(providerRegistry.generateWithFallback("same grounded prompt"), primaryError);
  assert.equal(groqCalls, 0);
});

test("returns a sanitized composite failure when both providers fail", async (t) => {
  installProviders(
    t,
    provider("gemini", "gemini-primary", async () => {
      throw Object.assign(new Error("Gemini failed with private prompt content"), { statusCode: 504, code: "GEMINI_GENERATION_TIMEOUT" });
    }),
    provider("groq", "groq-fallback", async () => {
      throw Object.assign(new Error("Groq failed with private prompt content"), { statusCode: 503, code: "GROQ_REQUEST_FAILED" });
    }),
    "test-groq-key"
  );

  await assert.rejects(providerRegistry.generateWithFallback("private prompt content"), (error: any) => {
    assert.equal(error.code, "AI_PROVIDER_FALLBACK_FAILED");
    assert.deepEqual(error.details.attempts.map((attempt: any) => attempt.providerId), ["gemini", "groq"]);
    assert.equal(JSON.stringify(error.details).includes("private prompt content"), false);
    return true;
  });
});
