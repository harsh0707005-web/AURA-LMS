import assert from "node:assert/strict";
import test from "node:test";
import { GroqProvider } from "../services/ai/groq.provider.js";

test("Groq adapter reports rate limits and retries without logging request data", async () => {
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = (async () => {
    attempts += 1;
    if (attempts === 1) {
      return new Response(JSON.stringify({ error: "limited" }), { status: 429, headers: { "retry-after": "0" } });
    }
    return new Response(JSON.stringify({
      model: "openai/gpt-oss-20b",
      choices: [{ message: { content: "answer" } }],
      usage: { prompt_tokens: 10, completion_tokens: 3, total_tokens: 13 },
    }), { status: 200, headers: { "content-type": "application/json" } });
  }) as any;

  try {
    const provider = new GroqProvider({ GROQ_API_KEY: "test-key", GROQ_MODEL: "openai/gpt-oss-20b" });
    const result = await provider.generateCompletion("bounded prompt");
    assert.equal(result.model, "openai/gpt-oss-20b");
    assert.equal(result.text, "answer");
    assert.equal(attempts, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Groq adapter fails clearly when no key is configured", async () => {
  const provider = new GroqProvider({ GROQ_MODEL: "openai/gpt-oss-20b" });
  await assert.rejects(provider.generateCompletion("prompt"), { code: "GROQ_NOT_CONFIGURED", statusCode: 503 });
});
