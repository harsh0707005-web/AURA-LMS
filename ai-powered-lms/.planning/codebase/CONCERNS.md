# Technical Risks, Concerns & Architecture Observations

This document outlines identified technical debt, potential failure points, performance considerations, and unfinished areas across **AURA LMS**.

---

## 1. Redundant Schema Models (`Material` vs `Document`)

### Observation

In [`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma), two separate models represent uploaded documents:
1. `Material`: The active model linked to `DocumentChunk` (with pgvector), `MaterialProgress`, and course routes.
2. `Document`: A legacy model containing similar metadata (`title`, `fileUrl`, `fileSize`, `processingStatus`), but not linked to chunks or vector retrieval.

### Risks

- Creates confusion for new developers joining the codebase.
- Dead database columns and tables accumulating in production.

### Recommendation

Formally deprecate and remove the `Document` model from `schema.prisma` in a future migration (Scheduled for Phase 17).

---

## 2. JWT Expiration & Refresh Token Architecture

### Observation

Authentication now uses short-lived HS256 access tokens plus database-backed refresh sessions. The access-token lifetime is configured through `ACCESS_TOKEN_EXPIRES_IN` and production validation caps it at one hour.

### Risks

- **Access-token window**: Logout revokes the refresh session, but an already-issued access token remains valid until expiry.
- **Refresh-session replay**: A reused rotated refresh token revokes the user's remaining refresh sessions; this is covered by the auth-session smoke tests.

### Recommendation

The current implementation uses the recommended dual-token shape with in-memory access tokens and database-backed HttpOnly refresh cookies. Shared rate limiting is still required before horizontal scaling.

---

## 3. Rate Limiting & Gemini API Cost / Quota Protection

### Observation

Neither the Express backend nor the AI endpoints implement HTTP rate limiting or request throttling.

### Risks

- **Gemini API Exhaustion**: An automated script or malicious user could repeatedly invoke `POST /api/ai/conversations/:id/messages`, rapidly consuming Google AI Studio API quotas and triggering `429 Too Many Requests` or unexpected billing.
- **Brute Force on Auth**: Endpoints `POST /api/auth/login` and `POST /api/auth/register` are unprotected against automated password guessing attacks.

### Recommendation

Add `express-rate-limit` middleware (Scheduled for Phase 16):
- Global API limiter (e.g., 100 requests per 15 minutes per IP).
- Strict Auth limiter (e.g., 5 login attempts per 15 minutes per IP).
- AI Endpoint limiter (e.g., 10 RAG queries per minute per user ID).

---

## 4. Vector Index Optimization (HNSW / IVFFlat)

### Observation

In PostgreSQL, the `DocumentChunk` table stores `vector(3072)` embeddings. Currently, queries perform exact KNN cosine distance searches (`ORDER BY (dc.embedding <=> query) ASC`).

### Risks

- While fast with current course notes (~dozens to hundreds of chunks), exact search scales as $O(N)$ and will experience latency degradation as thousands of pages and textbooks are uploaded.

### Recommendation

Create an approximate nearest neighbors HNSW index on the embedding column (Scheduled for Phase 17):

```sql
CREATE INDEX IF NOT EXISTS "DocumentChunk_embedding_hnsw_idx"
ON "DocumentChunk"
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

---

## 5. Test Framework Integration

### Observation

Test suites are structured as standalone Node.js/ts-node scripts in `backend/src/scripts/` rather than executed via a standard assertion framework (like Vitest or Jest).

### Recommendation

Wrap existing test scripts into a unified Vitest test runner setup so they can run in automated GitHub Actions CI/CD pipelines with code coverage reporting (Scheduled for Phase 18).

---

## Resolved Architectural Debt

### Resolved in Phase 14: Local Filesystem Dependency for Material PDFs

- **Resolution**: Migrated PDF uploads to S3-compatible cloud object storage with private backend proxy streaming (`S3StorageProvider` via `IStorageProvider`), 25MB file size limits, idempotent migration scripts (`migrate-materials-to-s3.ts`), reverse rollback safety (`restore-materials-from-s3.ts`), and 9/9 automated verification suites.

### Resolved in Phase 15: Template-Based Quiz Generator vs Real LLM Quiz Endpoint

- **Resolution**: Implemented dedicated backend endpoint `POST /api/ai/generate-quiz` utilizing Gemini 3.7 Flash structured JSON schemas, pgvector RAG retrieval with pre-retrieval material filtering, XML prompt boundaries, mandatory post-generation validation, ungrounded fallback safeguards, server-side publication idempotency, and interactive two-stage preview/publish lifecycle in `QuizGeneratorModal.tsx`.
