# Phase 15 User Acceptance Testing (UAT) Report

**Phase:** Phase 15: Server-Side LLM Quiz API<br>
**Milestone:** Milestone 2 (`v2.0` - Production Hardening & Cloud Scaling)<br>
**Branch:** `feature/phase-15-quiz-api`<br>
**Execution Date:** 2026-09-29<br>
**Result:** **100% VERIFIED & ACCEPTED (PASS)**

---

## 1. Test Methodology & Scope Clarification

> [!NOTE]
> **Test Harness Scope**: Automated testing in `test-phase15-quiz-generation.ts` executes **service-level and controller-level integration suites** using a deterministic mock LLM provider (`MockQuizLLMProvider`) and mocked embedding vectors.
>
> This verifies schema adherence, mandatory post-generation validation, RBAC guards, pgvector SQL queries, idempotency, and database transactions without external API network latency, quota consumption, or non-deterministic model variance.
>
> Controller-level input guards are verified via mock HTTP request/response invocation. Status codes (`400`, `403`, `404`, `422`, `502`) refer to `statusCode` properties enforced on service errors and mapped to HTTP responses by Express error middleware.

---

## 2. UAT Requirements & Acceptance Verification Matrix

| Requirement | Description | Acceptance Criteria | Test Harness Verification | Status |
| :--- | :--- | :--- | :--- | :--- |
| **REQ-AIQ-01** | Structured LLM Quiz Generation | Dedicated service/endpoint `POST /api/ai/generate-quiz` generating syllabus-grounded multi-choice questions with Gemini structured JSON output schema (`responseMimeType: "application/json"`). | Schema requires `sourceCitation`; controller verifies RBAC (`FACULTY`/`ADMIN`); output parsed safely as `unknown` with root object validation. Verified via Tests 9, 14A, 14B, 15, and 17. | **PASSED** |
| **REQ-AIQ-02** | Mandatory Server-Side Validation Layer | An independent validation layer in `quiz-generator.service.ts` verifies: 4 options, all options distinct and non-empty, correctOptionIndex in 0..3, valid BloomsLevel enum, valid Difficulty enum, non-empty fields, citations referencing retrieved chunks, and question count matching requested count. Zero persistence on failure. | Verified via Tests 1A–1F, 10A, 10B, and 11. Rejections throw structured error with `statusCode: 422`. Zero DB writes. | **PASSED** |
| **REQ-AIQ-03** | Course Vector Grounding & Material Filtering | Quizzes generated for courses with materials retrieve pgvector chunks (`DocumentChunk`), providing document name, unit, and page citations in questions. Material filtering is applied directly in vector query before Top-6 limit. | Verified via Tests 6A and 12. Pre-retrieval material filtering isolates target chunks; similarity computed with cosine distance (`<=>`). | **PASSED** |
| **REQ-AIQ-04** | Ungrounded Fallback Publishing Safety | When no materials match, quiz is generated from general curriculum fallback with `isGrounded: false`. Server prevents ungrounded publication without explicit acknowledgment (`fallbackAcknowledged: true`). Modal enforces acknowledgment checkbox. | Verified via Tests 6B, 13A, 13B, and frontend modal. Server returns `statusCode: 400` if fallback acknowledgment is missing. | **PASSED** |
| **REQ-AIQ-05** | Preview vs Persistence Lifecycle | `saveImmediately: false` generates preview in memory without database mutations. Only `saveImmediately: true` creates `Quiz` (with `isAiGenerated: true`) and `Question` records. | Verified via Tests 4 and 5. DB count unchanged on preview; quiz persisted with sequential `orderIndex` on publish. | **PASSED** |
| **REQ-AIQ-06** | Concurrency & Publication Idempotency | **Database-enforced** idempotency via `Quiz.idempotencyKey` UNIQUE column. Guarantees: (1) first publish creates exactly one quiz, (2) retry with same key returns existing quiz, (3) concurrent publishes with same key create exactly one quiz, (4) idempotency survives process restarts and memory eviction, (5) different keys create separate quizzes, (6) cross-course key reuse is rejected with 409. In-memory `IdempotencyManager` retained as a best-effort optimisation only — the DB UNIQUE constraint is the correctness guarantee. | Verified via Tests 16A–16F. DB findUnique-before-insert, P2002-catch-with-findUnique-fallback, and in-memory short-circuit all exercised. | **PASSED** |
| **REQ-AIQ-07** | Prompt Boundary Safety | Untrusted topic and syllabus data are encapsulated within XML tags (`<topic_data>`, `<syllabus_context>`) with explicit system safety directives to prevent prompt injection. | Verified via Test 15. Generated prompt confirms boundary tags and passive data directives. | **PASSED** |
| **REQ-QZ-01** | Student Answer Masking Security | Students retrieving quizzes via `GET /api/quizzes/:id` must not receive `correctOptionIndex` or `explanation` prior to submission. | Verified via Test 7. Fields completely stripped in student view, intact in faculty view. | **PASSED** |
| **REQ-ANL-01** | Learning Analytics & Weak Topic Tagging | Student attempts against AI-generated quizzes evaluate correctly and tag failed question topics into `QuizAttempt.weakTopicsIdentified`. | Verified via Test 8. Score 10/20 (50%) and `weakTopicsIdentified` recorded properly in PostgreSQL. | **PASSED** |

---

## 3. Automated Test Suite Execution Summary

Execution Command:

```powershell
npm run test:quiz --prefix backend
```

**40 Tests Executed | 40 Passed | 0 Failed | 0 Skipped (100% Pass Rate)**

```text
================================================================================
AURA LMS: PHASE 15 SERVER-SIDE LLM QUIZ API COMPREHENSIVE VERIFICATION SUITE
================================================================================

--- Executing Test 1: Mandatory Server-Side Validation Layer ---
[✅ PASS] 1A. Reject question with duplicate answer choices
       Expected: HTTP 422 with 'all 4 options must be distinct'
       Actual:   HTTP 422 (Duplicate options caught)

[✅ PASS] 1B. Reject question with fewer or more than 4 options
       Expected: HTTP 422 with 'must provide exactly 4 options'
       Actual:   HTTP 422 (3 options rejected)

[✅ PASS] 1C. Reject question with invalid correctOptionIndex (out of bounds)
       Expected: HTTP 422 with 'correctOptionIndex must be an integer between 0 and 3'
       Actual:   HTTP 422 (Index 4 rejected)

[✅ PASS] 1D. Reject question with invalid BloomsLevel enum
       Expected: HTTP 422 with 'bloomsLevel 'InvalidLevel' is invalid'
       Actual:   HTTP 422 (Invalid BloomsLevel rejected)

[✅ PASS] 1E. Reject grounded question missing sourceCitation
       Expected: HTTP 422 with 'grounded questions must provide a non-empty sourceCitation'
       Actual:   HTTP 422 (Empty citation rejected in grounded mode)

[✅ PASS] 1F. Accept ungrounded fallback question with empty sourceCitation
       Expected: Validation succeeds with sourceCitation: ''
       Actual:   Validation passed smoothly

--- Executing Test 2: Course Access & RBAC Authorization ---
[✅ PASS] 2A. Student role rejected from generating quiz
       Expected: HTTP 403 Forbidden
       Actual:   HTTP 403 Forbidden

[✅ PASS] 2B. Faculty rejected from generating quiz for other faculty's course
       Expected: HTTP 403 Forbidden
       Actual:   HTTP 403 Forbidden

[✅ PASS] 2C. Assigned faculty authorized to generate quiz for their course
       Expected: Success (questions returned)
       Actual:   Authorized and generated successfully

[✅ PASS] 2D. Administrator authorized to generate quiz on any course
       Expected: Success (questions returned)
       Actual:   Authorized and generated successfully

--- Executing Test 3: Input Validation Guards ---
[✅ PASS] 3A. Missing courseId rejected with HTTP 400
       Expected: HTTP 400 Bad Request
       Actual:   HTTP 400 Bad Request

[✅ PASS] 3B. Missing/blank topic rejected with HTTP 400
       Expected: HTTP 400 Bad Request
       Actual:   HTTP 400 Bad Request

[✅ PASS] 3C. Non-existent courseId rejected with HTTP 404
       Expected: HTTP 404 Not Found
       Actual:   HTTP 404 Not Found

--- Executing Test 4: Preview Lifecycle Isolation ---
[✅ PASS] 4. Preview mode generates in-memory with ZERO database mutations
       Expected: quiz === null, 0 new DB Quiz records, 0 new DB Question records
       Actual:   Zero DB writes confirmed, preview questions returned

--- Executing Test 5: Persistence Lifecycle ---
[✅ PASS] 5. Publish mode creates Quiz in DB with isAiGenerated=true and sequential orderIndex
       Expected: isAiGenerated: true, totalQuestions: 2, orderIndex: [1, 2]
       Actual:   Persisted Quiz ID, isAiGenerated=true, questions=2

--- Executing Test 6: Grounding vs Fallback Semantics ---
[✅ PASS] 6A. Course with syllabus chunks sets isGrounded=true and cites document
       Expected: isGrounded: true, sources count > 0, non-empty sourceCitation
       Actual:   Grounded in 2 chunk(s), cited: 'Distributed_Systems_Lec4.pdf (Unit: Unit 2, Page: 14)'

[✅ PASS] 6B. Course without chunks sets isGrounded=false and notes 'general curriculum fallback'
       Expected: isGrounded: false, sources: [], groundingNote mentions 'general curriculum fallback'
       Actual:   Fallback confirmed: isGrounded=false, note='Not grounded in uploaded course materials. Generated using general curriculum fallback.'

--- Executing Test 7: Student Answer Masking Security ---
[✅ PASS] 7. Student retrieval masks correctOptionIndex and explanation (REQ-QZ-01)
       Expected: Student view: undefined answers; Faculty view: complete answers
       Actual:   Student view correctly stripped, Faculty view intact

--- Executing Test 8: Student Quiz Attempt & Weak Topics Diagnostics ---
[✅ PASS] 8. Student attempt scoring and automated weak topic tagging
       Expected: Score: 10/20 (50%), weakTopicsIdentified includes failed question topic
       Actual:   Score: 10/20 (50%), weakTopics: [Quorum Mechanics]

--- Executing Test 9: Structured Schema Requires sourceCitation ---
[✅ PASS] 9. Require sourceCitation in structured Gemini JSON schema
       Expected: sourceCitation defined in properties and included in question required array
       Actual:   sourceCitation is explicitly required in QuizResponseSchema

--- Executing Test 10: Citation Validation Against Retrieved Chunks ---
[✅ PASS] 10A. Reject grounded question with hallucinated sourceCitation not in chunks
       Expected: HTTP 422 rejection when citation doesn't match retrieved chunks
       Actual:   HTTP 422 (Hallucinated document citation rejected)

[✅ PASS] 10B. Accept grounded question citing authentic retrieved chunk
       Expected: Validation passes for matching chunk documentName
       Actual:   Validated chunk citation successfully

--- Executing Test 11: Question Count Enforcement ---
[✅ PASS] 11. Enforce generated question count equals expectedCount
       Expected: HTTP 422 with 'expected exactly 3 questions, but model returned 1'
       Actual:   HTTP 422 (Question count mismatch rejected)

--- Executing Test 12: MaterialIds Filtering in pgvector Retrieval ---
[✅ PASS] 12. Apply materialIds filter directly in pgvector retrieval query
       Expected: All retrieved chunks strictly match materialIds filter
       Actual:   Retrieved 1 chunk(s) all matching target materialId

--- Executing Test 13: Ungrounded Fallback Publication Server-Side Guard ---
[✅ PASS] 13A. Prevent ungrounded fallback publish without explicit acknowledgment
       Expected: HTTP 400 rejection requiring fallbackAcknowledged confirmation
       Actual:   HTTP 400 (Ungrounded fallback publish rejected without acknowledgment)

[✅ PASS] 13B. Permit ungrounded fallback publish with explicit fallbackAcknowledged: true
       Expected: HTTP 201 / success when fallbackAcknowledged is true
       Actual:   Successfully published ungrounded quiz with ID

--- Executing Test 14: Safe Parsing as Unknown & Root Object Validation ---
[✅ PASS] 14A. Reject LLM JSON output when root is an array instead of an object
       Expected: HTTP 502 Bad Gateway with root object validation message
       Actual:   HTTP 502 (Invalid root array rejected)

[✅ PASS] 14B. Reject LLM JSON output when questions property is not an array
       Expected: HTTP 502 Bad Gateway with 'questions property must be a JSON array'
       Actual:   HTTP 502 (Non-array questions rejected)

--- Executing Test 15: Prompt Boundaries & Tag Encapsulation ---
[✅ PASS] 15. Encapsulate untrusted topic and syllabus data within XML prompt boundaries
       Expected: Prompt wraps untrusted data in <topic_data> and <syllabus_context> with boundary instructions
       Actual:   Prompt boundaries verified: <topic_data>, <syllabus_context>, and safety instructions active

--- Executing Test 16: Database-Enforced Publication Idempotency ---
[✅ PASS] 16A. First publish with idempotency key creates exactly one quiz
       Expected: Exactly 1 new Quiz row; quiz.id is non-null
       Actual:   Created Quiz ID 97803000-bada-4dd4-a703-765ca6f4d8b8, DB count Δ=1

[✅ PASS] 16B. Retry with same idempotency key returns existing quiz without creating a duplicate
       Expected: Same quiz ID returned, DB count unchanged
       Actual:   Idempotency verified: identical Quiz ID 97803000-bada-4dd4-a703-765ca6f4d8b8, DB count Δ=0

[✅ PASS] 16C. Concurrent publishes with same idempotency key create exactly one quiz
       Expected: Both concurrent requests resolve to the exact same Quiz ID with 1 database insertion
       Actual:   Concurrent safe: both resolved to 6415820c-d3c9-446d-a611-ef959a821bb9, DB count Δ=1

[✅ PASS] 16D. Different idempotency keys create separate independent quizzes
       Expected: Two distinct Quiz IDs created, DB count increases by 2
       Actual:   Two separate quizzes: 3c95c7c9-b2e5-4adb-b866-a2ee22abe0e9 and 2cecd9ba-641c-4e9b-b7f9-1e4dbee4ec0f, DB count Δ=2

[✅ PASS] 16E. DB-enforced idempotency persists after in-memory cache is cleared (process restart simulation)
       Expected: Same quiz ID as original, no new DB row created even after cache eviction
       Actual:   Persistent idempotency confirmed: quiz ID 97803000-bada-4dd4-a703-765ca6f4d8b8 unchanged, DB count Δ=0

[✅ PASS] 16F. Cross-course idempotency key collision is rejected with 409
       Expected: HTTP 409 when a key bound to one course is used for a different course
       Actual:   Correctly rejected cross-course reuse: Idempotency key collision: key is already bound to a different course

--- Executing Test 17: Controller Request Body Runtime Validation ---
[✅ PASS] 17A. Controller rejects invalid difficulty enum at runtime
       Expected: HTTP 400 Bad Request
       Actual:   HTTP 400 (Invalid difficulty rejected)

[✅ PASS] 17B. Controller rejects out-of-bounds questionCount (> 10) at runtime
       Expected: HTTP 400 Bad Request
       Actual:   HTTP 400 (questionCount 15 rejected)

[✅ PASS] 17C. Controller rejects invalid materialIds format at runtime
       Expected: HTTP 400 Bad Request
       Actual:   HTTP 400 (Invalid materialIds rejected)

[✅ PASS] 17D. Controller rejects non-boolean saveImmediately at runtime
       Expected: HTTP 400 Bad Request
       Actual:   HTTP 400 (Non-boolean saveImmediately rejected)

[✅ PASS] 17E. Controller rejects non-boolean fallbackAcknowledged at runtime
       Expected: HTTP 400 Bad Request
       Actual:   HTTP 400 (Non-boolean fallbackAcknowledged rejected)

--- Cleaning up Phase 15 test entities ---
================================================================================
PHASE 15 TEST RESULTS SUMMARY: 40 PASSED | 0 FAILED | 0 SKIPPED
================================================================================
```

---

## 4. Production Build Audits

- **Backend TypeScript Compilation (`tsc`)**:
  ```powershell
  npm run build --prefix backend
  ```
  Status: **PASS** (0 errors).

- **Frontend Next.js Compilation (`next build`)**:
  ```powershell
  npm run build --prefix frontend
  ```
  Status: **PASS** (32/32 production routes compiled with 0 errors).

---

## 5. User Acceptance Sign-Off

All CodeRabbit findings and Phase 15 deliverables, architectural requirements, validation layers, frontend UI controls, idempotency guards, and security boundaries have been fully implemented, tested, and formally verified. Phase 15 is marked **COMPLETED**.
