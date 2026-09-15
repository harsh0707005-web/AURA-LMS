# AURA LMS — AI-Powered Learning Management System

**Academic Institution:** Department of Computer Engineering • Final Year Capstone Project  
**System Version:** 1.0 (Academic Enterprise Baseline)  
**Project Classification:** Brownfield (Substantially Implemented, Fully Operational & Verified)

---

## 1. Executive Summary & Problem Definition

Higher education computer engineering curricula require students to absorb dense theoretical architectures (distributed systems, database storage engines, microarchitectures, and real-time operating systems) through extensive lecture notes and syllabus materials.

### Core Challenges Addressed:
1. **Generic AI Hallucination & Syllabus Drift**: Off-the-shelf LLMs cannot verify university-specific course boundaries, leading to out-of-syllabus answers and fabricated exam advice.
2. **Disconnected Study Tracking**: Students lack continuous reading progress synchronization between course materials and practice assessments.
3. **Delayed Academic Interventions**: Faculty members typically discover student difficulties only after final examinations, when pedagogical remediation is too late.

### The AURA LMS Solution:
AURA LMS bridges university learning materials with **real-time vector RAG (Retrieval-Augmented Generation)** powered by Google Gemini and PostgreSQL `pgvector`. Every AI answer is mathematically grounded in uploaded course notes with verified citations (document, unit, page, and similarity score). Student learning activity (quiz mistakes, reading progress) continuously informs an adaptive pedagogical tutor and alerts faculty to at-risk students before milestones conclude.

---

## 2. Target Personas & Core User Journeys

### 1. Student Persona (`STUDENT`)
- **Course Enrollment**: Enrolls in semester-specific department courses with duplicate protection.
- **Interactive Materials**: Reads lecture PDFs via an embedded canvas viewer that auto-saves page reading progress and supports one-click resume.
- **Course-Grounded AI Tutor**: Interacts with an academic AI tutor strictly constrained to the course syllabus. Questions receive answers with citations, follow-up suggestions, and explanations adapted to the student's identified weak areas.
- **Diagnostic Quizzes & Practice**: Attempts randomized quizzes with sanitized answer keys; receives immediate diagnostic scoring and syllabus topic tags.
- **Coursework & Solutions**: Submits assignment solutions and reviews graded feedback.
- **Learning Diagnostics**: Inspects aggregated KPI dashboards, critical/moderate weak syllabus topics, and recommended study items.

### 2. Faculty Persona (`FACULTY`)
- **Course Administration**: Creates and configures department courses with syllabus units and semester credits.
- **Material Processing & Ingestion**: Uploads course PDFs; system parses, chunks (~500 tokens), and embeds text into 3072-dimensional vectors in PostgreSQL.
- **Assessment Management**: Drafts diagnostic quizzes tagged with Bloom's taxonomy levels and difficulty ratings.
- **Grading Workflow**: Evaluates student assignment submissions with numerical scores and qualitative pedagogical remarks.
- **Cohort Mastery & Early Warning**: Monitors course-level performance averages and receives automated **At-Risk Student Alerts** (`HIGH` vs `MEDIUM` risk) with recommended remediation interventions.

### 3. Administrator Persona (`ADMIN`)
- **Institutional Governance**: Manages university user rosters across all three roles.
- **System Oversight**: Audits all courses, enrolled cohorts, and system health metrics.

---

## 3. Technology Stack & Key Dependencies

- **Frontend**: Next.js `16.3.0` (App Router), React `19.2.8`, Tailwind CSS `v4`, Stitch MCP Academic Design System tokens (`globals.css`), PDF.js client renderer.
- **Backend**: Node.js ESM runtime, Express `5.2.1`, TypeScript `5.9.3`.
- **Database**: PostgreSQL `18.6` with `pgvector 0.8.6` extension.
- **ORM & Client**: Prisma ORM `7.9.1` utilizing `@prisma/adapter-pg` and `pg.Pool`.
- **AI & Embeddings**: Google GenAI SDK (`@google/genai` `^2.18.0`), `gemini-embedding-001` (3072-dim vectors), `gemini-3.7-flash` (latency-optimized thinking budget = 0 for standard chat; 1024 for mathematical proofs).
- **Security & Cryptography**: `bcrypt` (10 rounds), `jsonwebtoken` (HS256 Bearer tokens).
- **File Parsing**: `multer` (multipart/form-data upload), `pdf-parse` (binary page text extraction).

---

## 4. Architectural Core Tenets

1. **Strict Factual Grounding**: AI responses are bounded by PostgreSQL cosine distance searches (`<=>`) scoped strictly to course notes. Out-of-syllabus questions trigger polite refusals without hallucinating citations.
2. **Zero-PII Prompt Injection**: Student identity markers (names, emails, IDs) are strictly excluded from AI prompts; only educational context (weak topics, progress) is injected.
3. **Dual-Layer Access Control**: Standard RBAC (`authorizeRoles`) prevents role elevation, while ownership isolation (`authorizeStudentAccess`) prevents cross-student IDOR vulnerabilities.
4. **Resilient Failover**: The AI provider implements exponential backoff retries and cascades across fallback models (`gemini-3.7-flash` $\to$ `gemini-3.5-flash` $\to$ `gemini-flash-latest` $\to$ `gemini-3.5-flash-lite`).

---

## 5. Repository Documentation References

- Architecture & Subsystems: [`.planning/codebase/ARCHITECTURE.md`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/.planning/codebase/ARCHITECTURE.md)
- Technology Stack & Tools: [`.planning/codebase/STACK.md`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/.planning/codebase/STACK.md)
- External APIs & Integrations: [`.planning/codebase/INTEGRATIONS.md`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/.planning/codebase/INTEGRATIONS.md)
- Project Structure & Routes: [`.planning/codebase/STRUCTURE.md`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/.planning/codebase/STRUCTURE.md)
- Coding Conventions & Standards: [`.planning/codebase/CONVENTIONS.md`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/.planning/codebase/CONVENTIONS.md)
- Testing & Audit Verification: [`.planning/codebase/TESTING.md`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/.planning/codebase/TESTING.md)
- Technical Risks & Future Work: [`.planning/codebase/CONCERNS.md`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/.planning/codebase/CONCERNS.md)
