# Phase 15 Plan: Server-Side LLM Quiz API (Revised)

**Phase:** Phase 15: Server-Side LLM Quiz API
**Milestone:** Milestone 2 (v2.0 - Production Hardening & Cloud Scaling)
**Status:** PLAN AWAITING EXECUTION APPROVAL (Revised per feedback)

---

## 1. Executive Summary & Objective

Implement a production-grade, syllabus-grounded academic assessment generator via a dedicated backend endpoint: `POST /api/ai/generate-quiz`. The endpoint retrieves pgvector document chunks from uploaded course materials via `RAGService`, formats a grounding prompt for `gemini-3.7-flash`, and utilizes Google Gemini's native structured JSON output (`responseMimeType: "application/json"`, `responseSchema`) to enforce question schemas (4 multiple-choice options, 0-based answer index, Bloom's taxonomy cognitive levels, detailed explanations, and source citations).

In addition to schema-level formatting, the backend incorporates a **mandatory, independent post-generation validation layer** in `quiz-generator.service.ts` that enforces option distinctness, valid enum values, index bounds, and citation rules before any payload is returned or persisted.

The frontend `QuizGeneratorModal.tsx` is upgraded from hardcoded synthetic mock questions to an **interactive two-step preview/publish lifecycle**. The preview action never touches the database, and ungrounded fallback quizzes (labeled as "general curriculum fallback") require explicit faculty acknowledgment before publication to ensure no ungrounded content is published silently.

---

## 2. File & Component Change Matrix

### Files to Create [NEW]
| File | Layer | Purpose |
| :--- | :--- | :--- |
| [`backend/src/services/ai/quiz-generator.service.ts`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/backend/src/services/ai/quiz-generator.service.ts) | Backend Service | Implements vector retrieval, Gemini structured JSON generation, mandatory post-generation validation layer, and database persistence with `isAiGenerated: true`. |
| [`backend/src/scripts/test-phase15-quiz-generation.ts`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/backend/src/scripts/test-phase15-quiz-generation.ts) | Test Suite | Standalone integration test suite verifying authorization, validation rejects, pgvector grounding, ungrounded fallback, lifecycle persistence guards, and student attempt safety. |

### Files to Modify [MODIFY]
| File | Layer | Changes |
| :--- | :--- | :--- |
| [`backend/src/services/ai/providers/llm-provider.interface.ts`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/backend/src/services/ai/providers/llm-provider.interface.ts) | Backend Interface | Add `responseMimeType?: string` and `responseSchema?: any` to `LLMGenerationOptions`. |
| [`backend/src/services/ai/gemini.provider.ts`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/backend/src/services/ai/gemini.provider.ts) | Backend Provider | Support `responseMimeType` and `responseSchema` in `genConfig` passed to `@google/genai`; utilize provider's supported thinking configuration (preferring low thinking level where supported). |
| [`backend/src/types/academic.types.ts`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/backend/src/types/academic.types.ts) | Backend Types | Define `GenerateQuizInput`, `GeneratedQuestion`, `GenerateQuizResponse`, and update `CreateQuizInput` with `isAiGenerated?: boolean`. |
| [`backend/src/services/quiz.service.ts`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/backend/src/services/quiz.service.ts) | Backend Service | Update `createQuiz()` to persist `isAiGenerated: Boolean(input.isAiGenerated)`. |
| [`backend/src/controllers/ai.controller.ts`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/backend/src/controllers/ai.controller.ts) | Backend Controller | Add `generateQuiz()` controller handler with input validation, course ownership check, and error mapping. |
| [`backend/src/routes/ai.routes.ts`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/backend/src/routes/ai.routes.ts) | Backend Routes | Mount `POST /generate-quiz` guarded by `authorizeRoles("FACULTY", "ADMIN")`. |
| [`backend/package.json`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/backend/package.json) | Package Scripts | Add `"test:quiz": "tsc && node dist/scripts/test-phase15-quiz-generation.js"`. |
| [`frontend/components/quiz/QuizGeneratorModal.tsx`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/frontend/components/quiz/QuizGeneratorModal.tsx) | Frontend Component | Implement preview/publish lifecycle with single-submit inflight guard, visible ungrounded warning, explicit confirmation checkbox for fallback publishing, and live citation badges. |

---

## 3. Preview / Publish Lifecycle & Duplicate Prevention

The quiz generation and creation lifecycle is partitioned into two clear stages:

```
[Faculty Parameter Form]
          │
          ▼ Click "Generate Preview"
  POST /api/ai/generate-quiz { saveImmediately: false }
          │
          ├── Vector retrieval (pgvector)
          ├── Gemini 3.7 Flash structured generation
          └── Mandatory Server-Side Validation Layer
          │
          ▼ (No Database Mutation)
[Interactive Review Modal View]
  - Question text & 4 distinct choices
  - Bloom's level & difficulty tags
  - Grounded source citations (or "General Curriculum Fallback" warning)
          │
          ├── If ungrounded: Faculty must check explicit acknowledgment box
          │
          ▼ Click "Publish Quiz"
  POST /api/ai/generate-quiz { saveImmediately: true }
          │
          ├── Single-Submit Inflight Lock (Prevents duplicate clicks)
          ├── Vector retrieval & schema generation + post-validation
          └── Prisma Transaction: Quiz (isAiGenerated=true) + Questions
          │
          ▼
[Quiz Published to Course Roster]
```

### Key Lifecycle Guarantees:
1. **Preview Isolation (`saveImmediately: false`)**:
   - Calling `POST /api/ai/generate-quiz` with `saveImmediately: false` generates and validates questions completely in memory.
   - **MUST NOT** create any `Quiz` or `Question` database records.
2. **Persistence Guarantee (`saveImmediately: true`)**:
   - **ONLY** requests with `saveImmediately: true` are permitted to execute `prisma.quiz.create`.
   - Sets `isAiGenerated: true` and attaches all questions with their respective `orderIndex`.
3. **Duplicate Publish Prevention**:
   - **Frontend Guard**: The publish button activates a disabled inflight state with an animated spinner, preventing double-clicks and concurrent submissions.
   - **Backend Handling**: Handled via atomic Prisma transaction creating the quiz and questions.

---

## 4. Gemini Thinking Configuration & Telemetry

- **Model**: `gemini-3.7-flash` (with fallback candidates in `GeminiProvider`).
- **Thinking Configuration**:
  - Uses the thinking configuration supported by the existing `@google/genai` provider abstraction.
  - Prefers a low thinking level where supported (e.g. `thinkingBudget: 0` or provider defaults) to minimize token overhead while maintaining academic rigor.
  - No fixed hardcoded claim of "sub-2s latency"; generation duration is treated as a **measured telemetry metric** returned in the response (`timing.generationMs` / `durationMs`).

---

## 5. Mandatory Server-Side Validation Layer

Structured Gemini JSON output is **not** treated as the sole validation mechanism. `quiz-generator.service.ts` executes an independent validation function on all generated questions prior to returning preview data or writing to the database:

### Validation Rules (Strict Fail-Fast):
1. **Question Count**: Validates that questions array length matches requested count (or at least 1 valid question within range 1..10).
2. **Options Count**: Exactly 4 options per question (`question.options.length === 4`).
3. **Options Distinctness & Non-Empty**: All 4 options must be non-empty strings, trimmed, and mutually distinct (`new Set(options.map(o => o.trim().toLowerCase())).size === 4`).
4. **Answer Index**: `correctOptionIndex` must be an integer strictly in the range `0..3`.
5. **Bloom's Taxonomy Level**: `bloomsLevel` must strictly match one of the 6 Prisma enum values: `Remember`, `Understand`, `Apply`, `Analyze`, `Evaluate`, `Create`.
6. **Difficulty Level**: `difficulty` must strictly match one of the 3 Prisma enum values: `Easy`, `Medium`, `Hard`.
7. **Question Content**: `question` string must be non-empty after trimming.
8. **Explanation Content**: `explanation` string must be non-empty after trimming.
9. **Topic Content**: `topic` string must be non-empty after trimming.
10. **Citation Integrity**:
    - Grounded questions (`isGrounded: true`): Must have a non-empty `sourceCitation` referencing the source material document and unit/page.
    - Ungrounded questions (`isGrounded: false`): May use an empty `sourceCitation`.

### Enforcement Action:
If any question fails any of the above validation checks:
- The backend immediately rejects the generation, throwing an HTTP 422 / 502 with a structured error indicating which validation rule was violated.
- **MUST NEVER** persist any `Quiz` or `Question` record to the database when validation fails.

---

## 6. Ungrounded Fallback Publishing Safety

When a course has no uploaded materials or no document chunks exceed the similarity threshold (`minSimilarity: 0.40`):
1. **Fallback Generation**:
   - The generator synthesizes questions based on general computer science / engineering curriculum standards for the requested topic.
   - Sets `isGrounded: false`.
   - Sets `groundingNote`: `"Not grounded in uploaded course materials. Generated using general curriculum fallback."`
   - Explicitly avoids claiming "accredited" or "independently verified" content unless an actual source document was retrieved.
2. **Frontend Warning**:
   - The preview modal displays a prominent warning banner:
     > ⚠️ **General Curriculum Fallback**
     > This quiz was generated from general curriculum knowledge because no matching course lecture notes were found. Questions are not verified against course-specific materials.
3. **Explicit Faculty Confirmation Required**:
   - When `isGrounded === false`, the "Publish Quiz" button remains **disabled** until the faculty checks an explicit acknowledgment:
     `[ ] I acknowledge that this quiz is based on general curriculum fallback and not course materials.`
   - **No silent publication** of ungrounded fallback content is permitted.

---

## 7. RAG Vector Grounding Architecture

- **Embedding & Distance**: Scoped to target `courseId` using pgvector cosine distance (`dc.embedding <=> queryVector`).
- **Retrieval Thresholds**: `topK: 6`, `minSimilarity: 0.40`.
- **Optional Filtering**: Optional `materialIds?: string[]` to constrain retrieval to specific lecture notes.
- **Context Assembly**:
  Retrieved chunks are formatted with `[SOURCE CHUNK: {documentName} | Unit: {unit} | Page: {pageNumber}]` and injected into the prompt.

---

## 8. Frontend `QuizGeneratorModal.tsx` Implementation

### Modal View States:
1. **Configuration View**:
   - Select Course, enter Topic, select Difficulty (`Easy`, `Medium`, `Hard`), Question Count (`2`, `3`, `5`, `10`), Time Limit.
   - Primary action button: `Generate Preview →` (calls `POST /api/ai/generate-quiz` with `saveImmediately: false`).
2. **Synthesis Loading State**:
   - Inflight spinner showing: `"Synthesizing syllabus questions with Gemini 3.7 Flash..."`.
   - Prevents duplicate clicks.
3. **Preview & Review View**:
   - Shows Grounding Status:
     - If Grounded: Green badge `✓ Grounded in Course Notes (X sources cited)`.
     - If Ungrounded: Yellow banner `⚠️ General Curriculum Fallback (Not grounded in uploaded notes)`.
   - Cards for each question showing question text, 4 options (correct option highlighted in green with checkmark for faculty), Bloom's taxonomy badge, difficulty badge, and citation tag.
   - If ungrounded: Confirmation checkbox required to unlock publish.
   - Actions:
     - `Back / Regenerate`: Returns to edit parameters.
     - `Publish Quiz to Course`: Calls `POST /api/ai/generate-quiz` with `saveImmediately: true` (with single-submit disable protection).
     - Upon publish: triggers `onQuizCreated()`, closes modal, and displays success toast.

---

## 9. Verification & Automated Test Plan

Create standalone verification script: `backend/src/scripts/test-phase15-quiz-generation.ts`.

### Test Cases in Suite:
1. **Authentication & Role Authorization**:
   - Reject unauthenticated request (`401 Unauthorized`).
   - Reject `STUDENT` role request (`403 Forbidden`).
   - Reject non-assigned `FACULTY` on another faculty's course (`403 Forbidden`).
   - Permit assigned `FACULTY` on their own course (`200 OK`).
   - Permit `ADMIN` on any course (`200 OK`).
2. **Input Validation**:
   - Missing `courseId` or `topic` -> `400 Bad Request`.
   - Non-existent `courseId` -> `404 Not Found`.
3. **Mandatory Post-Generation Validation Tests**:
   - Programmatically test validation layer rejecting:
     - Questions with duplicate options (e.g. `["A", "A", "B", "C"]`).
     - Questions with <4 or >4 options.
     - Questions with `correctOptionIndex` out of range (e.g. `4` or `-1`).
     - Questions with invalid `bloomsLevel` or `difficulty`.
     - Grounded questions missing `sourceCitation`.
   - Asserts database contains 0 new records when validation fails.
4. **Lifecycle & Persistence Separation**:
   - Call with `saveImmediately: false`: Asserts response has questions but DB count of `Quiz` and `Question` remains unchanged.
   - Call with `saveImmediately: true`: Asserts `Quiz` is persisted in DB with `isAiGenerated: true` and questions linked with sequential `orderIndex`.
5. **Vector Grounding vs General Curriculum Fallback**:
   - Grounded test with seeded material chunks: asserts `isGrounded: true`, sources returned, and citations present.
   - Fallback test with empty material course: asserts `isGrounded: false`, `groundingNote` mentions "general curriculum fallback", and empty citations allowed.
6. **Downstream Student Safety (REQ-QZ-01)**:
   - Verify student `GET /api/quizzes/:id` masks `correctOptionIndex` and `explanation`.
   - Verify student submission `POST /api/quizzes/:id/attempts` evaluates properly and updates `weakTopicsIdentified`.
