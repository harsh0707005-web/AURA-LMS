import {
  LLMGenerationOptions,
  LLMGenerationResult,
  LLMProvider,
  LLMAttemptTelemetry,
} from "./llm-provider.interface.js";
import { geminiProvider } from "../gemini.provider.js";
import { groqProvider } from "../groq.provider.js";

const MIN_CROSS_PROVIDER_BUDGET_MS = 1_000;

export interface ProviderGenerationResult {
  provider: LLMProvider;
  result: LLMGenerationResult;
}

/**
 * Provider Registry for AURA LMS Generation Layer.
 * Allows seamless hot-swapping or addition of generation providers
 * without modifying RAG retrieval, vector search, or database logic.
 */
class ProviderRegistry {
  private providers: Map<string, LLMProvider> = new Map();
  private defaultProviderId: string;

  constructor() {
    this.defaultProviderId = process.env.DEFAULT_LLM_PROVIDER || "gemini";
    // Register default Gemini provider
    this.registerProvider(geminiProvider);
    // Groq is optional and opt-in. Its absence must not affect the Gemini
    // baseline or the Gemini-backed embedding pipeline.
    if (process.env.GROQ_API_KEY) {
      this.registerProvider(groqProvider);
    }
  }

  public registerProvider(provider: LLMProvider): void {
    this.providers.set(provider.providerId.toLowerCase(), provider);
  }

  public setDefaultProviderId(providerId: string): void {
    this.defaultProviderId = providerId;
  }

  public getDefaultProviderId(): string {
    return this.defaultProviderId;
  }

  public getProvider(providerId?: string): LLMProvider {
    const id = (providerId || this.defaultProviderId).toLowerCase();
    const provider = this.providers.get(id);

    if (!provider) {
      // Keep Gemini as the safe baseline, but make an invalid or unavailable
      // provider selection visible instead of silently changing providers.
      const fallback = this.providers.get("gemini");
      if (fallback) {
        console.warn(`[AI PROVIDER CONFIG] '${id}' is unavailable; using Gemini baseline.`);
        return fallback;
      }
      throw new Error(`LLM Provider '${id}' not found in registry and no fallback available.`);
    }

    return provider;
  }

  public listRegisteredProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Generate with the selected provider and, when Gemini is primary, use the
   * opt-in Groq adapter only after Gemini generation fails. Retrieval and
   * embeddings are intentionally outside this orchestration path.
   */
  public async generateWithFallback(
    prompt: string,
    options?: LLMGenerationOptions
  ): Promise<ProviderGenerationResult> {
    const primary = this.getProvider();
    const startedAt = performance.now();

    try {
      const result = await primary.generateCompletion(prompt, options);
      return {
        provider: primary,
        result: withProviderAttempts(result, primary.providerId),
      };
    } catch (primaryError: any) {
      const fallback = this.providers.get("groq");
      if (primary.providerId !== "gemini" || !fallback || !process.env.GROQ_API_KEY?.trim()) {
        throw primaryError;
      }

      const remainingBudgetMs = remainingBudget(options?.generationBudgetMs, startedAt);
      if (remainingBudgetMs !== undefined && remainingBudgetMs < MIN_CROSS_PROVIDER_BUDGET_MS) {
        throw primaryError;
      }

      try {
        const fallbackOptions = withRemainingBudget(options, remainingBudgetMs);
        const fallbackResult = await fallback.generateCompletion(prompt, fallbackOptions);
        const primaryAttempts = attemptsFromFailure(primaryError, primary);
        const fallbackAttempts = withProviderAttempts(fallbackResult, fallback.providerId).attempts || [];

        return {
          provider: fallback,
          result: {
            ...fallbackResult,
            requestedModel: primary.modelName,
            durationMs: elapsedMs(startedAt),
            attempts: [...primaryAttempts, ...fallbackAttempts],
            retryCount: (primaryError?.details?.retryCount || 0) + (fallbackResult.retryCount || 0),
            fallbackUsed: true,
            backoffMs: (primaryError?.details?.backoffMs || 0) + (fallbackResult.backoffMs || 0),
          },
        };
      } catch (fallbackError: any) {
        throw createFallbackFailure(primary, primaryError, fallback, fallbackError);
      }
    }
  }
}

export const providerRegistry = new ProviderRegistry();

export function getLLMProvider(providerId?: string): LLMProvider {
  return providerRegistry.getProvider(providerId);
}

function withProviderAttempts(
  result: LLMGenerationResult,
  providerId: string
): LLMGenerationResult {
  return {
    ...result,
    attempts: (result.attempts || []).map((attempt) => ({ ...attempt, providerId })),
  };
}

function attemptsFromFailure(error: any, provider: LLMProvider): LLMAttemptTelemetry[] {
  const attempts = Array.isArray(error?.details?.attempts) ? error.details.attempts : [];
  if (attempts.length > 0) {
    return attempts.map((attempt: LLMAttemptTelemetry) => ({ ...attempt, providerId: provider.providerId }));
  }

  return [{
    providerId: provider.providerId,
    model: provider.modelName,
    attempt: 1,
    outcome: "error",
    durationMs: 0,
    status: error?.statusCode ?? error?.status,
    code: error?.code,
    error: `${provider.providerId} generation failed`,
  }];
}

function withRemainingBudget(
  options: LLMGenerationOptions | undefined,
  remainingBudgetMs: number | undefined
): LLMGenerationOptions | undefined {
  if (remainingBudgetMs === undefined) return options;

  const requestTimeoutMs = options?.requestTimeoutMs === undefined
    ? remainingBudgetMs
    : Math.min(options.requestTimeoutMs, remainingBudgetMs);

  return {
    ...options,
    generationBudgetMs: remainingBudgetMs,
    requestTimeoutMs,
  };
}

function remainingBudget(budgetMs: number | undefined, startedAt: number): number | undefined {
  if (budgetMs === undefined) return undefined;
  return Math.max(0, Math.floor(budgetMs - (performance.now() - startedAt)));
}

function elapsedMs(startedAt: number): number {
  return Math.max(1, Math.round(performance.now() - startedAt));
}

function createFallbackFailure(
  primary: LLMProvider,
  primaryError: any,
  fallback: LLMProvider,
  fallbackError: any
): Error {
  const error = new Error("Primary and fallback AI providers failed to generate a response");
  Object.assign(error, {
    statusCode: fallbackError?.statusCode ?? fallbackError?.status ?? primaryError?.statusCode ?? 502,
    code: "AI_PROVIDER_FALLBACK_FAILED",
    details: {
      attempts: [
        ...attemptsFromFailure(primaryError, primary),
        ...attemptsFromFailure(fallbackError, fallback),
      ],
    },
    cause: fallbackError,
  });
  return error;
}
