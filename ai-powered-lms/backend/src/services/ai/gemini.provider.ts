import { GoogleGenAI } from "@google/genai";
import {
  LLMProvider,
  LLMGenerationOptions,
  LLMGenerationResult,
  LLMAttemptTelemetry,
} from "./providers/llm-provider.interface.js";

const DEFAULT_REQUEST_TIMEOUT_MS = 45_000;
const DEFAULT_EMBEDDING_BUDGET_MS = 30_000;
const DEFAULT_GENERATION_BUDGET_MS = 90_000;
const DEFAULT_COMPLEX_GENERATION_BUDGET_MS = 120_000;
const DEFAULT_MAX_ATTEMPTS_PER_MODEL = 1;
const DEFAULT_MAX_TOTAL_ATTEMPTS = 4;
const MIN_GEMINI_HTTP_TIMEOUT_MS = 10_000;

export class GeminiProvider implements LLMProvider {
  public readonly providerId = "gemini";
  private ai: GoogleGenAI | null = null;
  private embeddingModelName: string;
  private generationModelName: string;
  private fallbackModels: string[];
  private defaultThinkingBudget: number;
  private complexThinkingBudget: number;
  private requestTimeoutMs: number;
  private embeddingBudgetMs: number;
  private generationBudgetMs: number;
  private complexGenerationBudgetMs: number;
  private maxAttemptsPerModel: number;
  private maxTotalAttempts: number;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
    }
    this.embeddingModelName = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
    this.generationModelName = process.env.GEMINI_GENERATION_MODEL || "gemini-3.7-flash";
    const configuredFallbacks = (process.env.GEMINI_FALLBACK_MODELS || "")
      .split(",")
      .map((model) => model.trim())
      .filter(Boolean);
    this.fallbackModels = configuredFallbacks.length > 0
      ? configuredFallbacks
      : [
          "gemini-3.7-flash",
          "gemini-3.5-flash",
          "gemini-flash-latest",
          "gemini-3.5-flash-lite",
        ];

    // Default fast thinking budget for normal academic chat (0 eliminates 3-6s overhead)
    this.defaultThinkingBudget = Number(process.env.GEMINI_THINKING_BUDGET ?? 0);
    // Elevated thinking budget for complex derivations / proofs
    this.complexThinkingBudget = Number(process.env.GEMINI_COMPLEX_THINKING_BUDGET ?? 1024);
    this.requestTimeoutMs = positiveInteger(process.env.GEMINI_REQUEST_TIMEOUT_MS, DEFAULT_REQUEST_TIMEOUT_MS);
    this.embeddingBudgetMs = positiveInteger(process.env.GEMINI_EMBEDDING_BUDGET_MS, DEFAULT_EMBEDDING_BUDGET_MS);
    this.generationBudgetMs = positiveInteger(process.env.GEMINI_GENERATION_BUDGET_MS, DEFAULT_GENERATION_BUDGET_MS);
    this.complexGenerationBudgetMs = positiveInteger(
      process.env.GEMINI_COMPLEX_GENERATION_BUDGET_MS,
      DEFAULT_COMPLEX_GENERATION_BUDGET_MS
    );
    this.maxAttemptsPerModel = positiveInteger(
      process.env.GEMINI_MAX_ATTEMPTS_PER_MODEL,
      DEFAULT_MAX_ATTEMPTS_PER_MODEL
    );
    this.maxTotalAttempts = positiveInteger(process.env.GEMINI_MAX_TOTAL_ATTEMPTS, DEFAULT_MAX_TOTAL_ATTEMPTS);
  }

  public get modelName(): string {
    return this.generationModelName;
  }

  private getClient(): GoogleGenAI {
    if (!this.ai) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw Object.assign(
          new Error("GEMINI_API_KEY is not configured on the server. Please contact administrator."),
          { statusCode: 503 }
        );
      }
      this.ai = new GoogleGenAI({ apiKey });
    }
    return this.ai;
  }

  /**
   * Generates a 3072-dimensional vector embedding for text using Google GenAI SDK (@google/genai).
   * Includes exponential backoff for transient rate limits.
   */
  public async embedText(text: string, retries = 3): Promise<number[]> {
    const client = this.getClient();
    const sanitized = text.trim();
    if (!sanitized) {
      throw Object.assign(new Error("Cannot generate embedding for empty text"), { statusCode: 400 });
    }

    const deadline = performance.now() + this.embeddingBudgetMs;
    let delay = 1000;
    for (let attempt = 1; attempt <= retries; attempt++) {
      const remainingMs = Math.floor(deadline - performance.now());
      if (remainingMs <= 0) {
        throw Object.assign(new Error("Gemini embedding request budget exceeded"), {
          statusCode: 504,
          code: "GEMINI_EMBEDDING_TIMEOUT",
        });
      }

      if (this.requestTimeoutMs >= MIN_GEMINI_HTTP_TIMEOUT_MS && remainingMs < MIN_GEMINI_HTTP_TIMEOUT_MS) {
        throw Object.assign(new Error("Gemini embedding request budget is below the provider minimum timeout"), {
          statusCode: 504,
          code: "GEMINI_EMBEDDING_TIMEOUT",
        });
      }

      const timeoutMs = Math.max(1, Math.min(this.requestTimeoutMs, remainingMs));
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await client.models.embedContent({
          model: this.embeddingModelName,
          contents: sanitized,
          config: {
            httpOptions: { timeout: timeoutMs },
            abortSignal: controller.signal,
          },
        });

        const values = response.embeddings?.[0]?.values;
        if (!values || !Array.isArray(values) || values.length === 0) {
          throw new Error("Received empty or invalid embedding vector from Gemini API");
        }
        return values;
      } catch (error: any) {
        const normalizedError = normalizeGeminiTimeout(error, "embedding");
        const safeMessage = (error?.message || String(error)).replace(/[A-Za-z0-9_-]{35,}/g, "[REDACTED_KEY]");
        const retryable = isRetryableGeminiError(normalizedError);
        if (attempt === retries || !retryable || performance.now() >= deadline) {
          throw Object.assign(new Error(`Gemini Embedding Error: ${safeMessage}`), {
            statusCode: normalizedError?.statusCode || normalizedError?.status || 502,
            code: normalizedError?.code || "GEMINI_EMBEDDING_FAILED",
          });
        }
        const waitMs = Math.min(delay, Math.max(0, Math.floor(deadline - performance.now())));
        if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
        delay *= 2;
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new Error("Gemini embedding retry limit exceeded");
  }

  /**
   * Generates completion using Google GenAI SDK with latency-optimized thinking configuration,
   * multi-model failover, and structured telemetry.
   */
  public async generateCompletion(
    prompt: string,
    options?: LLMGenerationOptions
  ): Promise<LLMGenerationResult> {
    const client = this.getClient();
    const startTime = performance.now();

    // Determine thinking budget:
    // Explicit override > complexity based ('complex' -> 1024) > normal academic chat default (0)
    let effectiveBudget = this.defaultThinkingBudget;
    if (options?.thinkingBudget !== undefined) {
      effectiveBudget = options.thinkingBudget;
    } else if (options?.complexity === "complex") {
      effectiveBudget = this.complexThinkingBudget;
    }

    const modelsToTry = [
      this.generationModelName,
      ...this.fallbackModels.filter((m) => m !== this.generationModelName),
    ];

    let lastError: any = null;
    const attempts: LLMAttemptTelemetry[] = [];
    let retryCount = 0;
    let backoffMs = 0;
    let totalAttempts = 0;
    const configuredGenerationBudgetMs = options?.complexity === "complex"
      ? this.complexGenerationBudgetMs
      : this.generationBudgetMs;
    const generationBudgetMs = Math.min(
      configuredGenerationBudgetMs,
      positiveInteger(options?.generationBudgetMs?.toString(), configuredGenerationBudgetMs)
    );
    const requestTimeoutMs = Math.min(
      this.requestTimeoutMs,
      positiveInteger(options?.requestTimeoutMs?.toString(), this.requestTimeoutMs)
    );
    const deadline = startTime + generationBudgetMs;

    for (const modelName of modelsToTry) {
      let delay = 1000;
      for (let attempt = 1; attempt <= this.maxAttemptsPerModel; attempt++) {
        if (totalAttempts >= this.maxTotalAttempts || performance.now() >= deadline) break;
        totalAttempts += 1;
        const attemptStartedAt = performance.now();
        const remainingMs = Math.floor(deadline - attemptStartedAt);
        if (requestTimeoutMs >= MIN_GEMINI_HTTP_TIMEOUT_MS && remainingMs < MIN_GEMINI_HTTP_TIMEOUT_MS) {
          lastError = Object.assign(new Error("Gemini generation request budget is below the provider minimum timeout"), {
            statusCode: 504,
            code: "GEMINI_GENERATION_TIMEOUT",
          });
          attempts.push({
            model: modelName,
            attempt,
            outcome: "error",
            durationMs: 0,
            status: 504,
            code: "GEMINI_GENERATION_TIMEOUT",
            error: sanitizeGeminiError(lastError),
          });
          break;
        }
        const timeoutMs = Math.max(1, Math.min(requestTimeoutMs, remainingMs));
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
          // Build the common request configuration. Do not send a zero-valued
          // thinkingConfig: Gemini models that do not expose configurable
          // thinking reject the entire request when that field is present,
          // even though zero is intended to mean "disabled".
          const genConfig: any = {
            temperature: options?.temperature ?? 0.2, // Low temperature for high academic precision
            topP: options?.topP ?? 0.9,
            maxOutputTokens: options?.maxOutputTokens ?? 2048,
          };

          // Positive budgets remain opt-in for complex requests. Every model
          // in the fallback chain receives the same supported shape; the
          // zero-budget path omits the field entirely for compatibility.
          if (effectiveBudget > 0) {
            genConfig.thinkingConfig = { thinkingBudget: effectiveBudget };
          }

          // Structured Output Configuration
          if (options?.responseMimeType) {
            genConfig.responseMimeType = options.responseMimeType;
          }
          if (options?.responseSchema) {
            genConfig.responseSchema = options.responseSchema;
          }
          genConfig.httpOptions = { timeout: timeoutMs };
          genConfig.abortSignal = controller.signal;

          const response = await client.models.generateContent({
            model: modelName,
            contents: prompt,
            config: genConfig,
          });

          const responseText = response.text;
          if (responseText && responseText.trim().length > 0) {
            attempts.push({
              model: modelName,
              attempt,
              outcome: "success",
              durationMs: elapsedMs(attemptStartedAt),
            });
            const durationMs = Math.round(performance.now() - startTime);
            const usage = response.usageMetadata
              ? {
                  promptTokens: response.usageMetadata.promptTokenCount,
                  completionTokens: response.usageMetadata.candidatesTokenCount,
                  thoughtTokens: (response.usageMetadata as any).thoughtsTokenCount,
                  totalTokens: response.usageMetadata.totalTokenCount,
                }
              : undefined;

            return {
              text: responseText.trim(),
              model: modelName,
              requestedModel: this.generationModelName,
              usage,
              durationMs,
              thinkingBudgetUsed: effectiveBudget,
              attempts,
              retryCount,
              fallbackUsed: modelName !== this.generationModelName,
              backoffMs,
              promptChars: prompt.length,
              outputChars: responseText.trim().length,
            };
          }
          throw Object.assign(new Error("Gemini returned an empty completion"), {
            status: 502,
            code: "GEMINI_EMPTY_COMPLETION",
          });
        } catch (error: any) {
          lastError = normalizeGeminiTimeout(error, "generation");
          attempts.push({
            model: modelName,
            attempt,
            outcome: "error",
            durationMs: elapsedMs(attemptStartedAt),
            status: lastError?.status ?? lastError?.statusCode,
            code: lastError?.code,
            error: sanitizeGeminiError(lastError),
          });

          if (!isRetryableGeminiError(lastError)) {
            throw createGeminiGenerationError(this.generationModelName, lastError, attempts, retryCount, backoffMs);
          }

          if (attempt < this.maxAttemptsPerModel && totalAttempts < this.maxTotalAttempts) {
            const waitMs = Math.min(delay, Math.max(0, Math.floor(deadline - performance.now())));
            if (waitMs > 0) {
              retryCount += 1;
              backoffMs += waitMs;
              await new Promise((resolve) => setTimeout(resolve, waitMs));
              delay *= 2;
              continue;
            }
          }
          break; // Try the next fallback model, if the request budget remains.
        } finally {
          clearTimeout(timeout);
        }
      }
    }

    throw createGeminiGenerationError(this.generationModelName, lastError, attempts, retryCount, backoffMs);
  }
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

function elapsedMs(startTime: number): number {
  return Math.max(1, Math.round(performance.now() - startTime));
}

function normalizeGeminiTimeout(error: any, operation: "embedding" | "generation"): any {
  if (error?.name !== "AbortError" && error?.code !== "UND_ERR_HEADERS_TIMEOUT") return error;
  return Object.assign(new Error(`Gemini ${operation} request timed out`), {
    statusCode: 504,
    code: operation === "embedding" ? "GEMINI_EMBEDDING_TIMEOUT" : "GEMINI_GENERATION_TIMEOUT",
    cause: error,
  });
}

function isRetryableGeminiError(error: any): boolean {
  const status = error?.status ?? error?.statusCode;
  return (
    status === 408 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    error?.code === "GEMINI_GENERATION_TIMEOUT" ||
    error?.code === "GEMINI_EMBEDDING_TIMEOUT" ||
    error?.code === "GEMINI_EMPTY_COMPLETION" ||
    error?.message?.includes("high demand") ||
    error?.message?.includes("temporarily unavailable")
  );
}

function createGeminiGenerationError(
  requestedModel: string,
  lastError: any,
  attempts: LLMAttemptTelemetry[],
  retryCount: number,
  backoffMs: number
): Error {
  const safeError = sanitizeGeminiError(lastError) || "Unknown model generation error";
  const generationError = new Error(
    `Gemini generation failed for requested model ${requestedModel}. Last Gemini error: ${safeError}`,
    { cause: lastError }
  );
  Object.assign(generationError, {
    statusCode: lastError?.status ?? lastError?.statusCode ?? 502,
    code: lastError?.code || "GEMINI_GENERATION_FAILED",
    details: { provider: "gemini", requestedModel, attempts, retryCount, backoffMs },
  });
  return generationError;
}

/**
 * Preserve useful provider diagnostics without copying API keys, prompts, or
 * arbitrary SDK objects into application logs or HTTP responses.
 */
function sanitizeGeminiError(error: any): string {
  if (!error) return "";

  const fields = {
    message: typeof error.message === "string" ? error.message : String(error),
    status: error.status ?? error.statusCode,
    code: error.code,
    statusText: error.statusText,
    details: error.details,
  };

  let serialized: string;
  try {
    serialized = JSON.stringify(fields, (_key, value) => {
      if (typeof value === "string") {
        return value
          .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[REDACTED_KEY]")
          .replace(/[A-Za-z0-9_-]{35,}/g, "[REDACTED_TOKEN]")
          .slice(0, 2000);
      }
      return value;
    });
  } catch {
    serialized = fields.message.slice(0, 2000);
  }

  return serialized.length > 4000 ? `${serialized.slice(0, 4000)}…` : serialized;
}

export const geminiProvider = new GeminiProvider();
