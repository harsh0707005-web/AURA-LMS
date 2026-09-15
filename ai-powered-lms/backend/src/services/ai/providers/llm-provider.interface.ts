/**
 * LLM Provider Abstraction Interface for AURA LMS
 * 
 * Allows swapping or adding generation providers (e.g., Gemini, Grok, NVIDIA NIM, OpenAI)
 * without altering the underlying RAG vector retrieval, embedding pipeline, or pgvector schemas.
 */

export interface LLMGenerationOptions {
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  thinkingBudget?: number; // 0 for low latency (no thinking), >0 for reasoning models
  complexity?: "normal" | "complex";
}

export interface LLMGenerationResult {
  text: string;
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    thoughtTokens?: number;
    totalTokens?: number;
  };
  durationMs: number;
  thinkingBudgetUsed?: number;
}

export interface LLMProvider {
  readonly providerId: string;
  readonly modelName: string;
  generateCompletion(prompt: string, options?: LLMGenerationOptions): Promise<LLMGenerationResult>;
}
