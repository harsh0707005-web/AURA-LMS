import { geminiProvider } from "./gemini.provider.js";

export class EmbeddingService {
  public static readonly EXPECTED_DIMENSION = 3072;

  /**
   * Generates embedding vector for text and validates dimensionality.
   */
  public async embedText(text: string): Promise<number[]> {
    const vector = await geminiProvider.embedText(text);
    if (vector.length !== EmbeddingService.EXPECTED_DIMENSION) {
      console.warn(
        `[EmbeddingService] Dimension mismatch: expected ${EmbeddingService.EXPECTED_DIMENSION}, got ${vector.length}`
      );
    }
    return vector;
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
    return `[${vector.join(",")}]`;
  }
}

export const embeddingService = new EmbeddingService();
