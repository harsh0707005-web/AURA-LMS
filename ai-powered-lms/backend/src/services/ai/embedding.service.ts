import { geminiProvider } from "./gemini.provider.js";

export class EmbeddingService {
  public static readonly EXPECTED_DIMENSION = 3072;

  /**
   * Generates embedding vector for text and validates dimensionality.
   */
  public async embedText(text: string): Promise<number[]> {
    const vector = await geminiProvider.embedText(text);
    this.validateDimension(vector);
    return vector;
  }

  private validateDimension(vector: number[]): void {
    if (vector.length !== EmbeddingService.EXPECTED_DIMENSION) {
      throw Object.assign(new Error("Embedding vector has an invalid dimension"), {
        statusCode: 502,
        code: "EMBEDDING_DIMENSION_MISMATCH",
        details: { expected: EmbeddingService.EXPECTED_DIMENSION, actual: vector.length },
      });
    }
  }

  /**
   * Generates embeddings for an array of text chunks sequentially or in controlled batches.
   */
  public async embedDocuments(texts: string[], concurrency = 3): Promise<number[][]> {
    const results: number[][] = [];
    for (let i = 0; i < texts.length; i += concurrency) {
      const batch = texts.slice(i, i + concurrency);
      const batchVectors = await Promise.all(batch.map((t) => this.embedText(t)));
      results.push(...batchVectors);
    }
    return results;
  }

  /**
   * Formats a numeric JavaScript array into a pgvector-compatible literal string "[v1,v2,...,vn]".
   */
  public toVectorLiteral(vector: number[]): string {
    this.validateDimension(vector);
    return `[${vector.join(",")}]`;
  }
}

export const embeddingService = new EmbeddingService();
