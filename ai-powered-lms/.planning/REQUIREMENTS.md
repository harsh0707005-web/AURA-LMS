# System Requirements Specification

This document defines the functional and technical requirements for **AURA LMS**.

---

## 1. Milestone 1: Core Platform & Vector RAG (`v1.0`) — Fully Verified

The following requirements have been implemented, integrated, and verified through automated end-to-end integration test suites and runtime audits:

### 1. Authentication, Identity & RBAC
- **REQ-AUTH-01 (Public Registration)**: The system MUST allow public registration for `STUDENT` and `FACULTY` accounts with email, password, department, and enrollment/employee numbers.
- **REQ-AUTH-02 (Admin Role Protection)**: The public registration API MUST reject requests attempting to register with role `ADMIN` with `400 Bad Request`.
- **REQ-AUTH-03 (Duplicate Prevention)**: Registration MUST enforce uniqueness on institutional email addresses, rejecting duplicates with `409 Conflict`.
- **REQ-AUTH-04 (Password Hashing)**: User passwords MUST be hashed using `bcrypt` with a minimum of 10 salt rounds before database persistence.
- **REQ-AUTH-05 (JWT Authentication)**: The login endpoint MUST issue an HS256 JWT bearer token containing `userId`, `role`, `email`, and `department`.
- **REQ-AUTH-06 (Session Check)**: The endpoint `GET /api/auth/me` MUST return the authenticated, sanitized user profile without leaking `passwordHash`.
- **REQ-RBAC-01 (Role Authorization)**: Protected endpoints MUST restrict access to authorized roles via `authorizeRoles(...)`, returning `403 Forbidden` for role violations.
- **REQ-RBAC-02 (IDOR Student Isolation)**: Student-specific routes (`/api/students/:id/*`, `/api/analytics/student/:id`) MUST enforce `authorizeStudentAccess("id")`, ensuring students cannot access other students' records.

### 2. Course Catalog & Enrollment
- **REQ-CRS-01 (Course Listing)**: Authenticated users MUST be able to list courses and view course details including credits, syllabus units, and faculty information.
- **REQ-CRS-02 (Course Management)**: Faculty and Admins MUST be able to create, update, and delete courses.
- **REQ-CRS-03 (Student Enrollment)**: Students MUST be able to enroll in active courses. Re-enrollment in the same course MUST return `409 Conflict`.

### 3. Materials Ingestion & PDF Streaming
- **REQ-MAT-01 (PDF Upload)**: Faculty MUST be able to upload course lecture notes via multipart form-data (PDF format, max 50 MB).
- **REQ-MAT-02 (Text Extraction & Chunking)**: The system MUST automatically parse PDF pages using `pdf-parse` and divide content into deterministic, overlapping text chunks (~500 tokens / 2000 chars, ~75 tokens overlap).
- **REQ-MAT-03 (Vector Embedding)**: The system MUST compute 3072-dimensional vector embeddings for all chunks using Google Gemini (`gemini-embedding-001`) with automatic retry and rate-limit backoff.
- **REQ-MAT-04 (pgvector Storage)**: Vector embeddings MUST be persisted into the PostgreSQL `DocumentChunk` table with `vector(3072)`.
- **REQ-MAT-05 (Protected Streaming)**: The endpoint `GET /api/materials/:id/file` MUST stream raw binary PDF data only to faculty, admins, or enrolled students.
- **REQ-MAT-06 (Continuous Progress Tracking)**: The system MUST persist student reading progress (`currentPage`, `totalPages`, `progressPercent`, `completed`), supporting debounced updates and resume-from-saved-page.

### 4. AI Academic Tutor & Vector RAG Pipeline
- **REQ-AI-01 (Conversation Management)**: Users MUST be able to create, list, and delete persistent AI conversation threads bound to specific courses.
- **REQ-AI-02 (Vector Semantic Search)**: Student queries MUST generate a query vector and perform cosine distance search (`<=>`) in PostgreSQL strictly scoped to the course (`WHERE m."courseId" = $targetCourse`).
- **REQ-AI-03 (Similarity Filtering)**: Chunks with cosine similarity below `0.55` MUST be excluded from prompt context.
- **REQ-AI-04 (Zero-PII Pedagogical Context)**: The system MUST inject sanitized student profile context (weak topics, progress) without including personal identity markers (names, emails, IDs).
- **REQ-AI-05 (Grounded LLM Completion)**: Answers MUST be generated via `gemini-3.7-flash` (with latency thinking budget = 0 for standard chat; 1024 for complex proofs), citing document name, unit, page, and similarity score.
- **REQ-AI-06 (Anti-Hallucination Guardrail)**: When query context is insufficient or out-of-syllabus, the model MUST explicitly indicate that the topic is not covered in uploaded course notes.
- **REQ-AI-07 (Conversational Continuity)**: The tutor MUST maintain context across consecutive messages using recent conversation history.

### 5. Quizzes & Assessment Engine
- **REQ-QZ-01 (Quiz Delivery)**: Students retrieving quizzes MUST NOT receive correct option indices or explanations before submission.
- **REQ-QZ-02 (Evaluation & Scoring)**: Submissions MUST be evaluated server-side, calculating score, total points, and percentage.
- **REQ-QZ-03 (Weak Topic Tagging)**: Failed quiz questions MUST automatically populate `QuizAttempt.weakTopicsIdentified`.
- **REQ-QZ-04 (Quiz Authoring)**: Faculty MUST be able to create quizzes with Bloom's taxonomy tags and difficulty levels.

### 6. Coursework & Assignments
- **REQ-ASG-01 (Assignment Delivery)**: Students MUST be able to submit text and file solutions for course assignments.
- **REQ-ASG-02 (Faculty Grading)**: Faculty MUST be able to grade submissions with numerical scores and qualitative pedagogical feedback.

### 7. Learning Analytics & Early Intervention
- **REQ-ANL-01 (Student Weak Topics)**: The system MUST aggregate failed topics into `CRITICAL` ($>1$ failure) and `MODERATE` ($1$ failure) severity ratings with recommended actions.
- **REQ-ANL-02 (Personalized Recommendations)**: The system MUST generate targeted study recommendations linking directly to lecture units and quizzes.
- **REQ-ANL-03 (Faculty Cohort Analytics)**: Faculty MUST have visibility into course averages, completion rates, and submission tallies.
- **REQ-ANL-04 (At-Risk Student Alerts)**: The system MUST automatically classify students as `HIGH` risk ($< 40\%$ progress and $< 60\%$ quiz average) or `MEDIUM` risk ($< 50\%$ progress or $< 65\%$ quiz average) with suggested interventions.

### 8. Institutional Governance & UI/UX Standards
- **REQ-ADM-01 (User Directory)**: Admins MUST be able to inspect and manage all university accounts.
- **REQ-UI-01 (Institutional Aesthetics)**: The frontend MUST adhere to Stitch MCP academic design system tokens, WCAG 2.1 AA contrast standards, and `@media (prefers-reduced-motion: reduce)`.

---

## 2. Milestone 2: Production Hardening & Cloud Scaling (`v2.0`) — Planned Backlog

The following requirements represent technical enhancements identified during architectural mapping:

### 1. Cloud Object Storage
- **REQ-S3-01 (Cloud PDF Storage)**: Migrate material PDF storage from local filesystem (`backend/uploads/materials`) to S3-compatible cloud object storage (AWS S3, Cloudflare R2, or Google Cloud Storage).
- **REQ-S3-02 (Presigned Streaming URLs)**: Serve protected PDF downloads via time-limited presigned URLs with enrollment verification.

### 2. Server-Side LLM Quiz Generation
- **REQ-AIQ-01 (Real LLM Quiz API)**: Implement a dedicated backend endpoint `POST /api/ai/generate-quiz` that generates multi-choice questions with structured JSON output, Bloom's taxonomy levels, and syllabus references grounded in course vector chunks.

### 3. Security & Rate Limiting Hardening
- **REQ-SEC-01 (API Rate Limiting)**: Implement Express rate-limiting middleware to guard against brute-force attacks on `/api/auth/*` and quota exhaustion on `/api/ai/*`.
- **REQ-SEC-02 (Refresh Token Rotation)**: Transition authentication from static 7-day tokens to short-lived access tokens (15–30 minutes) and secure HttpOnly refresh cookies.

### 4. Database Optimization & Maintenance
- **REQ-OPT-01 (HNSW Indexing)**: Create an approximate nearest neighbors HNSW index on `DocumentChunk.embedding` for sub-10ms semantic search at scale.
- **REQ-DB-01 (Schema Deprecation)**: Remove the legacy unused `Document` model from `schema.prisma`.
- **REQ-CI-01 (Automated Test Pipeline)**: Wrap standalone test scripts into a unified Vitest test runner for CI/CD integration.
