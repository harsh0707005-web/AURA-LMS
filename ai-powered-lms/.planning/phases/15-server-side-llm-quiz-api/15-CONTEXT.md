# Phase 15 Context & Confirmed Decisions: Server-Side LLM Quiz API (Revised)

**Phase:** Phase 15: Server-Side LLM Quiz API
**Milestone:** Milestone 2 (v2.0 - Production Hardening & Cloud Scaling)
**Status:** Locked Decisions for Planning (Revised per user requirements)

---

## 1. Confirmed Architecture Decisions

### Decision 1: Dedicated AI Quiz Endpoint & Preview/Publish Lifecycle
- **Route**: `POST /api/ai/generate-quiz` mounted under Express router `/api/ai`.
- **Authorization**: Guarded by `authenticate` and `authorizeRoles("FACULTY", "ADMIN")`.
- **Ownership Check**: Faculty callers must either be the course creator (`course.facultyId === req.user.userId`) or hold role `ADMIN`. Unauthorized access is rejected with `403 Forbidden`.
- **Strict Preview/Publish Lifecycle**:
  - **Generate Action (Preview Mode)**: Frontend calls `POST /api/ai/generate-quiz` with `saveImmediately: false`.
    - Generates questions, citations, Bloom's tags, and explanations.
    - **MUST NOT** create any `Quiz` or `Question` records in PostgreSQL.
    - Returns structured payload for faculty review in the modal.
  - **Publish Action (Persistence Mode)**: Frontend calls `POST /api/ai/generate-quiz` with `saveImmediately: true` (or persists the validated preview).
    - **ONLY** `saveImmediately: true` creates database records in PostgreSQL (`Quiz` with `isAiGenerated: true` and associated `Question` records).
    - **Duplicate Publish Prevention**: Protected by client-side submission disabling / single-submit guard during inflight publish requests, plus transactional database creation.

### Decision 2: Gemini Thinking Configuration & Structured Schema
- **Model**: `gemini-3.7-flash` (with multi-model fallback chain from `GeminiProvider`).
- **Configuration**:
  - `responseMimeType: "application/json"`.
  - `responseSchema`: Strict OpenAPI / Gemini Schema defining `quizTitle` and array of `questions`.
  - **Thinking Configuration**: Leverages the thinking configuration supported by the existing `@google/genai` provider abstraction, preferring a low thinking level where supported.
  - **Latency Semantics**: Latency is a measured telemetry metric (`durationMs`), not a fixed latency guarantee or SLA claim.
- **Question Schema Structure**:
  - Array of question objects containing question text, 4 options, correctOptionIndex, explanation, bloomsLevel, difficulty, topic, and sourceCitation.

### Decision 3: Mandatory Server-Side Post-Generation Validation Layer
Structured Gemini output is **not** treated as the sole validation mechanism. `quiz-generator.service.ts` enforces a strict, independent server-side validation layer on the parsed output prior to returning or persisting:
1. **Option Count**: Exactly 4 options per question.
2. **Option Distinctness & Integrity**: All 4 options must be non-empty strings and mutually distinct (no duplicate choices).
3. **Answer Index Range**: `correctOptionIndex` must be an integer strictly in the range `0..3`.
4. **Bloom's Taxonomy**: `bloomsLevel` must be one of the 6 valid Prisma enum values: `Remember`, `Understand`, `Apply`, `Analyze`, `Evaluate`, `Create`.
5. **Difficulty Level**: `difficulty` must be one of the 3 valid Prisma enum values: `Easy`, `Medium`, `Hard`.
6. **Question Content**: `question` text must be non-empty.
7. **Explanation Content**: `explanation` text must be non-empty.
8. **Topic Content**: `topic` string must be non-empty.
9. **Citation Integrity**: Grounded questions (`isGrounded: true`) must possess a non-empty `sourceCitation` referencing the source material; ungrounded fallback questions may use an empty `sourceCitation`.

**Failure Rule**: Any validation failure immediately rejects the generated quiz with a descriptive error and **must never** persist a `Quiz` or `Question` to the database.

### Decision 4: Course Vector Grounding & Ungrounded Fallback Publishing Safety
- **Retrieval Engine**: Leverage `RAGService.retrieveRelevantChunksWithTiming(topic, courseId, { topK: 6, minSimilarity: 0.40 })`.
- **Material Filtering**: Allow optional `materialIds?: string[]` to constrain retrieval to specific lecture notes or syllabus units.
- **Ungrounded / General Curriculum Fallback Safety**:
  - When no relevant course chunks exist (no materials uploaded or similarity < 0.40):
    - System sets `isGrounded: false`.
    - Sets `groundingNote` explicitly explaining that the generated content is not grounded in uploaded course materials, using phrasing such as **"general curriculum fallback"** (without implying independently verified or accredited content unless an actual source document was retrieved).
  - **Faculty Visibility & Confirmation**:
    - Preview mode **must visibly warn** the faculty that the quiz is ungrounded / general curriculum fallback.
    - Publishing an ungrounded quiz **requires explicit faculty confirmation** in the UI (e.g. confirmation checkbox / acknowledgment modal).
    - **No silent publication** of ungrounded fallback content.

### Decision 5: Downstream Student Privacy & Learning Analytics Compatibility
- **Student Privacy Guardrail (REQ-QZ-01)**: When fetched by students via `GET /api/quizzes/:id`, `correctOptionIndex` and `explanation` remain stripped until submission.
- **Weak Topic Diagnostics (REQ-ANL-01 & Phase 7)**: Student attempts against AI-generated quizzes properly record failed question topics into `QuizAttempt.weakTopicsIdentified`, seamlessly feeding into the Phase 9 Learning Analytics and At-Risk student detection pipelines.
- **Database Schema**: Leverages existing Prisma schema field `Quiz.isAiGenerated` (Boolean default false).
