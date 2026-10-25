# External Services, APIs & System Integrations

This document catalogues all external systems, APIs, database engines, file storage pipelines, and environment dependencies integrated into **AURA LMS**.

---

## 1. Google Gemini & GenAI SDK Integration

### SDK & Client Configuration
- **Package**: `@google/genai` (`^2.18.0`)
- **Initialization**: Managed via singleton provider in [`backend/src/services/ai/gemini.provider.ts`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/backend/src/services/ai/gemini.provider.ts).
- **Authentication**: `GEMINI_API_KEY` stored exclusively in backend `.env` (never exposed to frontend client).

### Vector Embedding Service
- **Model**: `gemini-embedding-001` (configured via `GEMINI_EMBEDDING_MODEL`)
- **Dimension**: 3072-dimensional floating-point vectors (`vector(3072)`)
- **Method**: `ai.models.embedContent({ model, contents })`
- **Batching**: Controlled concurrency batches (concurrency: 3) with exponential backoff (initial delay: 1000ms, doubling up to 3 retries).
- **Formatting**: Serialized into pgvector literal format `[v1,v2,...,v3072]` for raw SQL inserts into PostgreSQL.

### Academic Tutor LLM Generation
- **Primary Model**: `gemini-3.7-flash` (configured via `GEMINI_GENERATION_MODEL`)
- **Fallback Models**: Uses the ordered `GEMINI_FALLBACK_MODELS` list, or the built-in `gemini-3.5-flash` $\to$ `gemini-flash-latest` $\to$ `gemini-3.5-flash-lite` sequence, when the primary encounters retryable rate limits, timeouts, or 5xx/high-demand errors. Requested and responding models are recorded separately.
- **Thinking Budget Optimization**:
  - **Standard Academic Chat**: Default budget set to `0` (`GEMINI_THINKING_BUDGET=0`), eliminating 3–6s model thinking latency for high-speed responsiveness.
  - **Complex Derivations**: Automatically detects proofs/derivations/theorems via regex and increases budget to `1024` tokens (`GEMINI_COMPLEX_THINKING_BUDGET=1024`).
- **Generation Parameters**:
  - Temperature: `0.2` (Low temperature for deterministic, hallucination-free academic precision)
  - TopP: `0.9`
  - MaxOutputTokens: `1200` for normal tutor responses and `1600` for complex tutor responses by default.
- **Budgets**: Gemini network attempts are bounded by `GEMINI_REQUEST_TIMEOUT_MS` (default `45000` ms); normal and complex generation budgets default to `90000` ms and `120000` ms. Generation defaults to one attempt per model and four total attempts.
- **Telemetry**: Full execution profiling tracking embedding latency, pgvector search time, context assembly time, generation latency, token metrics, prompt/output character counts, requested/responding model, fallback attempts, retry count, and backoff time without logging prompt content.

---

## 2. PostgreSQL & pgvector Database Integration

### Database Engine & Extension
- **Database Server**: PostgreSQL 18.6
- **Vector Extension**: `pgvector 0.8.6`
- **Adapter**: `@prisma/adapter-pg` coupled with `pg.Pool` connection pooling in [`backend/src/lib/prisma.ts`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/backend/src/lib/prisma.ts).

### pgvector Cosine Distance Search (`<=>`)
- Vector search is executed natively in SQL via `prisma.$queryRawUnsafe`:
```sql
SELECT 
  dc.id AS "chunkId",
  dc."materialId",
  m.title AS "documentName",
  m.unit,
  dc."pageNumber",
  dc.content,
  dc."tokenCount",
  (dc.embedding <=> $1::vector) AS "distance",
  (1 - (dc.embedding <=> $1::vector)) AS "similarity"
FROM "DocumentChunk" dc
JOIN "Material" m ON m.id = dc."materialId"
WHERE m."courseId" = $2 AND dc.embedding IS NOT NULL
ORDER BY (dc.embedding <=> $1::vector) ASC
LIMIT $3;
```
- **Similarity Threshold**: Filtered at `RAG_MIN_SIMILARITY` (default `0.55`, computed as `1 - distance`).
- **Top-K Retrieval**: Scoped to `RAG_TOP_K` (default `5` chunks).
- **Course Isolation**: All queries are strictly constrained by `WHERE m."courseId" = $2`, preventing cross-course information leakage.

---

## 3. Frontend-Backend API Communication

### Protocol & Port Configuration
- **Frontend Server**: Next.js App Router on `http://localhost:3000`
- **Backend API**: Express.js REST service on `http://localhost:5000/api`
- **CORS Allowlist**: Configured in [`backend/src/server.ts`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/backend/src/server.ts) for `http://localhost:3000` and `http://127.0.0.1:3000`.

### Client Request Pipeline (`frontend/lib/api.ts`)
- **`apiRequest<T>(endpoint, options)`**:
  - Reads stored auth token from `localStorage` via `getAuthToken()`.
  - Injects `Authorization: Bearer <token>` and `Content-Type: application/json`.
  - Parses JSON response or extracts server error messages with status codes.
- **`checkBackendHealth()`**:
  - Pings `GET /api/health/db` on load to verify database connectivity.

---

## 4. File Storage & Streaming Pipeline

### PDF Upload Pipeline
- **Middleware**: Multer disk storage in [`backend/src/middleware/upload.middleware.ts`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/backend/src/middleware/upload.middleware.ts).
- **Local Directory**: Files persisted to `backend/uploads/materials/`.
- **Validation**: Strict MIME filter allowing only `application/pdf`, max file size 50 MB.
- **Processing**: Synchronously extracts page text using `pdf-parse`, breaks into overlapping chunks (~500 tokens / 2000 chars, ~75 tokens overlap), computes Gemini vector embeddings, and saves into `DocumentChunk` table.

### Protected Binary PDF Streaming
- **Endpoint**: `GET /api/materials/:id/file`
- **Access Control**:
  - `FACULTY` and `ADMIN`: Granted immediate access.
  - `STUDENT`: Scoped authorization verifies student is actively enrolled in the parent course (`Enrollment` table).
- **Delivery**: Streams raw binary PDF with headers:
  - `Content-Type: application/pdf`
  - `Content-Disposition: inline; filename="<filename>.pdf"`

---

## 5. Environment Variables & Secret Configuration

### Backend Environment (`backend/.env`)
| Variable | Required | Default | Purpose |
| :--- | :--- | :--- | :--- |
| `PORT` | No | `5000` | HTTP listening port for Express backend |
| `FRONTEND_URL` | No | `http://localhost:3000` | Origin URL permitted by CORS policy |
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string with pgvector support |
| `JWT_SECRET` | **Yes** | — | Secret key used for signing and verifying HS256 JWTs |
| `GEMINI_API_KEY` | **Yes** | — | Google AI Studio API key for embedding and completion |
| `GEMINI_EMBEDDING_MODEL` | No | `gemini-embedding-001` | 3072-dim text embedding model |
| `GEMINI_GENERATION_MODEL` | No | `gemini-3.7-flash` | Primary academic tutor generation model; Gemini model fallbacks remain first |
| `GEMINI_FALLBACK_MODELS` | No | Built-in fallback list | Ordered comma-separated fallback models |
| `GEMINI_THINKING_BUDGET` | No | `0` | Thinking budget for low-latency academic responses |
| `GEMINI_COMPLEX_THINKING_BUDGET` | No | `1024` | Thinking budget for mathematical proofs and derivations |
| `GEMINI_REQUEST_TIMEOUT_MS` | No | `45000` | Per-network-attempt Gemini timeout |
| `GEMINI_EMBEDDING_BUDGET_MS` | No | `30000` | Total embedding retry budget |
| `GEMINI_GENERATION_BUDGET_MS` | No | `90000` | Normal Gemini generation/fallback budget, including optional Groq failover time |
| `GEMINI_COMPLEX_GENERATION_BUDGET_MS` | No | `120000` | Complex generation budget |
| `GEMINI_MAX_ATTEMPTS_PER_MODEL` | No | `1` | Maximum generation attempts per model |
| `GEMINI_MAX_TOTAL_ATTEMPTS` | No | `4` | Maximum generation attempts across fallback models |
| `GEMINI_TUTOR_MAX_OUTPUT_TOKENS` | No | `1200` | Normal tutor output cap |
| `GEMINI_TUTOR_COMPLEX_MAX_OUTPUT_TOKENS` | No | `1600` | Complex tutor output cap |
| `AI_MESSAGE_WORKFLOW_TIMEOUT_MS` | No | `120000` | Durable AI-message workflow deadline |
| `DEFAULT_LLM_PROVIDER` | No | `gemini` | Active generation provider; Gemini remains primary when selected and Groq is opt-in failover |
| `GROQ_API_KEY` | No | Unset | Optional Groq credential for generation-only failover; does not change Gemini embeddings |
| `GROQ_MODEL` | No | `openai/gpt-oss-20b` | Optional Groq completion model |
| `GROQ_API_URL` | No | Groq chat-completions endpoint | Optional Groq endpoint override |
| `GROQ_TIMEOUT_MS` | No | `30000` | Per-attempt Groq timeout |
| `RAG_TOP_K` | No | `5` | Maximum number of chunks to retrieve per RAG query |
| `RAG_MIN_SIMILARITY` | No | `0.55` | Cosine similarity threshold for RAG grounding |
| `RAG_MAX_CONTEXT_CHARS` | No | `10000` | Maximum retrieved context characters |
| `RAG_MAX_HISTORY_CHARS` | No | `4000` | Maximum conversation history characters |

### Frontend Environment (`frontend/.env.local`)
| Variable | Required | Default | Purpose |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | No | `http://localhost:5000/api` | Backend base URL used by client-side fetchers |
| `NEXT_PUBLIC_AI_REQUEST_TIMEOUT_MS` | No | `125000` | Client abort window for tutor requests |
