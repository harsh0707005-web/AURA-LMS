/**
 * In-Process Idempotency Cache (OPTIMISATION LAYER ONLY).
 *
 * This cache short-circuits concurrent in-process requests that share the same
 * idempotency key so only one async action is awaited by all callers.  It is NOT
 * the correctness guarantee for idempotency across process restarts, multiple
 * server instances, or cache eviction.
 *
 * The true, persistent idempotency guarantee is the DATABASE-LEVEL UNIQUE CONSTRAINT
 * on `Quiz.idempotencyKey` (column: "idempotencyKey", index: "Quiz_idempotencyKey_key").
 * The database constraint is:
 *   - Process-restart safe (data survives server crashes)
 *   - Multi-instance safe (all nodes share the same PostgreSQL database)
 *   - Race-safe (the DB serialises concurrent INSERT attempts; the loser gets P2002
 *     and falls back to a final findUnique to return the winning row)
 */

interface IdempotencyEntry<T> {
  promise?: Promise<T>;
  response?: T;
  createdAt: number;
}

export class IdempotencyManager {
  private cache = new Map<string, IdempotencyEntry<any>>();
  private readonly defaultTtlMs: number;

  constructor(defaultTtlMs = 5 * 60 * 1000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  /**
   * Executes an asynchronous action idempotently for a given idempotency key.
   * If a concurrent request is already running for this key, it awaits the existing promise.
   * If an earlier request succeeded within the TTL window, it returns the cached response.
   */
  public async execute<T>(
    key: string,
    action: () => Promise<T>,
    ttlMs = this.defaultTtlMs
  ): Promise<{ data: T; isCached: boolean }> {
    this.purgeExpired();

    const existing = this.cache.get(key);
    if (existing) {
      if (existing.response !== undefined) {
        return { data: existing.response, isCached: true };
      }
      if (existing.promise) {
        const data = await existing.promise;
        return { data, isCached: true };
      }
    }

    const entry: IdempotencyEntry<T> = {
      createdAt: Date.now(),
    };

    const actionPromise = action()
      .then((result) => {
        entry.response = result;
        delete entry.promise;
        return result;
      })
      .catch((error) => {
        // Evict key immediately on error so retries can succeed
        this.cache.delete(key);
        throw error;
      });

    entry.promise = actionPromise;
    this.cache.set(key, entry);

    const data = await actionPromise;
    return { data, isCached: false };
  }

  /**
   * Evicts entries that exceed their retention TTL.
   */
  private purgeExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.createdAt > this.defaultTtlMs) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clears the entire idempotency cache. Useful for test isolation.
   */
  public clear(): void {
    this.cache.clear();
  }

  /**
   * Returns current active keys in cache.
   */
  public getActiveKeys(): string[] {
    return Array.from(this.cache.keys());
  }
}

export const quizPublicationIdempotency = new IdempotencyManager();
