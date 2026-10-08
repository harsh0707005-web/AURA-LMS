import { GoogleGenAI } from "@google/genai";
import {
  LLMProvider,
  LLMGenerationOptions,
  LLMGenerationResult,
} from "./providers/llm-provider.interface.js";

export class GeminiProvider implements LLMProvider {
  public readonly providerId = "gemini";
  private ai: GoogleGenAI | null = null;
  private embeddingModelName: string;
  private generationModelName: string;
  private fallbackModels: string[];
  private defaultThinkingBudget: number;
  private complexThinkingBudget: number;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
    }
    this.embeddingModelName = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
    this.generationModelName = process.env.GEMINI_GENERATION_MODEL || "gemini-3.7-flash";
    this.fallbackModels = [
      "gemini-3.7-flash",
      "gemini-3.5-flash",
      "gemini-flash-latest",
      "gemini-3.5-flash-lite",
    ];

    // Default fast thinking budget for normal academic chat (0 eliminates 3-6s overhead)
    this.defaultThinkingBudget = Number(process.env.GEMINI_THINKING_BUDGET ?? 0);
    // Elevated thinking budget for complex derivations / proofs
    this.complexThinkingBudget = Number(process.env.GEMINI_COMPLEX_THINKING_BUDGET ?? 1024);
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

    let delay = 1000;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await client.models.embedContent({
          model: this.embeddingModelName,
          contents: sanitized,
        });

        const values = response.embeddings?.[0]?.values;
        if (!values || !Array.isArray(values) || values.length === 0) {
          throw new Error("Received empty or invalid embedding vector from Gemini API");
        }
        return values;
      } catch (error: any) {
        const safeMessage = (error?.message || String(error)).replace(/[A-Za-z0-9_-]{35,}/g, "[REDACTED_KEY]");
        if (attempt === retries || error?.status === 400 || error?.status === 401 || error?.status === 403) {
          throw Object.assign(new Error(`Gemini Embedding Error: ${safeMessage}`), { statusCode: error?.status || 502 });
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
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

    for (const modelName of modelsToTry) {
      let delay = 1000;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          // Build config with thinking configuration
          const genConfig: any = {
            temperature: options?.temperature ?? 0.2, // Low temperature for high academic precision
            topP: options?.topP ?? 0.9,
            maxOutputTokens: options?.maxOutputTokens ?? 2048,
          };

          // Apply thinkingConfig selectively:
          // If effectiveBudget === 0, apply only to models that accept budget 0 (3.7-flash, flash-latest, 3.5-flash)
          if (effectiveBudget === 0) {
            if (modelName.includes("3.7") || modelName === "gemini-flash-latest" || modelName.includes("3.5")) {
              genConfig.thinkingConfig = { thinkingBudget: 0 };
            }
          } else if (effectiveBudget > 0) {
            genConfig.thinkingConfig = { thinkingBudget: effectiveBudget };
          }

          // Structured Output Configuration
          if (options?.responseMimeType) {
            genConfig.responseMimeType = options.responseMimeType;
          }
          if (options?.responseSchema) {
            genConfig.responseSchema = options.responseSchema;
          }

          const response = await client.models.generateContent({
            model: modelName,
            contents: prompt,
            config: genConfig,
          });

          const responseText = response.text;
          if (responseText && responseText.trim().length > 0) {
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
              usage,
              durationMs,
              thinkingBudgetUsed: effectiveBudget,
            };
          }
        } catch (error: any) {
          lastError = error;
          const isRateLimitOrUnavailable =
            error?.status === 503 ||
            error?.status === 429 ||
            error?.message?.includes("503") ||
            error?.message?.includes("high demand");

          if (isRateLimitOrUnavailable && attempt < 3) {
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay *= 2;
            continue;
          }
          break; // Try next fallback model
        }
      }
    }

    const safeError = lastError?.message || "Unknown model generation error";
    throw new Error(`All Gemini model candidates failed: ${safeError}`);
  }
}

export const geminiProvider = new GeminiProvider();
