import { LLMProvider } from "./llm-provider.interface.js";
import { geminiProvider } from "../gemini.provider.js";

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
  }

  public registerProvider(provider: LLMProvider): void {
    this.providers.set(provider.providerId.toLowerCase(), provider);
  }

  public setDefaultProviderId(providerId: string): void {
    this.defaultProviderId = providerId;
  }

  public getProvider(providerId?: string): LLMProvider {
    const id = (providerId || this.defaultProviderId).toLowerCase();
    const provider = this.providers.get(id);

    if (!provider) {
      // Fall back to Gemini provider
      const fallback = this.providers.get("gemini");
      if (fallback) return fallback;
      throw new Error(`LLM Provider '${id}' not found in registry and no fallback available.`);
    }

    return provider;
  }

  public listRegisteredProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}

export const providerRegistry = new ProviderRegistry();

export function getLLMProvider(providerId?: string): LLMProvider {
  return providerRegistry.getProvider(providerId);
}
