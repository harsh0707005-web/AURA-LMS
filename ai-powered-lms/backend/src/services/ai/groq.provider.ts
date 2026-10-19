import {
  LLMGenerationOptions,
  LLMGenerationResult,
  LLMProvider,
} from "./providers/llm-provider.interface.js";

const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";
const DEFAULT_GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

/**
 * Optional OpenAI-compatible Groq adapter. It is never selected unless the
 * caller configures GROQ_API_KEY and DEFAULT_LLM_PROVIDER=groq. Embeddings
 * remain on Gemini so the 3072-dimensional pgvector index is unchanged.
 */
export class GroqProvider implements LLMProvider {
  public readonly providerId = "groq";
  public readonly modelName: string;
  private readonly apiKey?: string;
  private readonly endpoint: string;
  private readonly timeoutMs: number;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.apiKey = env.GROQ_API_KEY;
    this.modelName = env.GROQ_MODEL || DEFAULT_GROQ_MODEL;
    this.endpoint = env.GROQ_API_URL || DEFAULT_GROQ_ENDPOINT;
    this.timeoutMs = Number(env.GROQ_TIMEOUT_MS) || 30000;
  }

  public async generateCompletion(
    prompt: string,
    options?: LLMGenerationOptions
  ): Promise<LLMGenerationResult> {
    if (!this.apiKey) {
      throw Object.assign(new Error("GROQ_API_KEY is not configured"), {
        statusCode: 503,
        code: "GROQ_NOT_CONFIGURED",
      });
    }

    const requestBody: Record<string, unknown> = {
      model: this.modelName,
      messages: [{ role: "user", content: prompt }],
      temperature: options?.temperature ?? 0.2,
      top_p: options?.topP ?? 0.9,
      max_tokens: options?.maxOutputTokens ?? 2048,
    };

    if (options?.responseMimeType === "application/json") {
      requestBody.response_format = options.responseSchema
        ? {
            type: "json_schema",
            json_schema: {
              name: "aura_response",
              strict: false,
              schema: normalizeJsonSchema(options.responseSchema),
            },
          }
        : { type: "json_object" };
    }

    const startedAt = performance.now();
    const requestTimeoutMs = Math.min(this.timeoutMs, positiveInteger(options?.requestTimeoutMs, this.timeoutMs));
    let lastError: unknown;
    const attempts: Array<{
      model: string;
      attempt: number;
      outcome: "success" | "error";
      durationMs: number;
      status?: number;
      code?: string;
      error?: string;
    }> = [];
    let backoffMs = 0;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const attemptStartedAt = performance.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
      try {
        const response = await fetch(this.endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        if (!response.ok) {
          const retryable = response.status === 429 || response.status >= 500;
          const retryAfter = Number(response.headers.get("retry-after")) || 0;
          const error = Object.assign(new Error(`Groq request failed with status ${response.status}`), {
            statusCode: response.status,
            code: response.status === 429 ? "GROQ_RATE_LIMITED" : "GROQ_REQUEST_FAILED",
            retryAfterSeconds: retryAfter,
          });
          lastError = error;
          attempts.push({
            model: this.modelName,
            attempt,
            outcome: "error",
            durationMs: Math.max(1, Math.round(performance.now() - attemptStartedAt)),
            status: response.status,
            code: error.code,
          });
          if (retryable && attempt < 2) {
            const waitMs = Math.min(5000, retryAfter * 1000 || 500);
            backoffMs += waitMs;
            await new Promise((resolve) => setTimeout(resolve, waitMs));
            continue;
          }
          throw error;
        }

        const payload = (await response.json()) as any;
        const text = payload?.choices?.[0]?.message?.content;
        if (typeof text !== "string" || !text.trim()) {
          throw Object.assign(new Error("Groq returned an empty completion"), {
            statusCode: 502,
            code: "GROQ_EMPTY_COMPLETION",
          });
        }

        attempts.push({
          model: payload?.model || this.modelName,
          attempt,
          outcome: "success",
          durationMs: Math.max(1, Math.round(performance.now() - attemptStartedAt)),
        });

        return {
          text: text.trim(),
          model: payload?.model || this.modelName,
          requestedModel: this.modelName,
          usage: payload?.usage
            ? {
              promptTokens: payload.usage.prompt_tokens,
              completionTokens: payload.usage.completion_tokens,
              totalTokens: payload.usage.total_tokens,
            }
          : undefined,
          durationMs: Math.max(1, Math.round(performance.now() - startedAt)),
          thinkingBudgetUsed: 0,
          attempts,
          retryCount: attempt - 1,
          fallbackUsed: false,
          backoffMs,
          promptChars: prompt.length,
          outputChars: text.trim().length,
        };
      } catch (error: any) {
        lastError = error?.name === "AbortError"
          ? Object.assign(new Error("Groq request timed out"), { statusCode: 504, code: "GROQ_TIMEOUT" })
          : error;
        if (!attempts.some((entry) => entry.attempt === attempt && entry.outcome === "error")) {
          const typedError = lastError as any;
          attempts.push({
            model: this.modelName,
            attempt,
            outcome: "error",
            durationMs: Math.max(1, Math.round(performance.now() - attemptStartedAt)),
            status: typedError?.statusCode ?? typedError?.status,
            code: typedError?.code,
            error: sanitizeGroqError(typedError || lastError),
          });
        }
        if (attempt >= 2 || !isRetryableGroqError(lastError)) throw lastError;
        backoffMs += 500;
        await new Promise((resolve) => setTimeout(resolve, 500));
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError || new Error("Groq request failed");
  }
}

function isRetryableGroqError(error: any): boolean {
  return error?.statusCode === 429 || error?.statusCode >= 500 || error?.code === "GROQ_TIMEOUT";
}

function sanitizeGroqError(error: any): string {
  return String(error?.message || error || "Unknown error")
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]")
    .replace(/[A-Za-z0-9_-]{35,}/g, "[REDACTED_TOKEN]")
    .slice(0, 1000);
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && (value as number) > 0 ? Math.round(value as number) : fallback;
}

function normalizeJsonSchema(value: any): any {
  if (Array.isArray(value)) return value.map(normalizeJsonSchema);
  if (!value || typeof value !== "object") return value;

  const normalized: Record<string, any> = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === "type" && typeof child === "string") {
      normalized[key] = child.toLowerCase();
    } else {
      normalized[key] = normalizeJsonSchema(child);
    }
  }
  return normalized;
}

export const groqProvider = new GroqProvider();
