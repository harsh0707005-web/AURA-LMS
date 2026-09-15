# Testing, Quality Assurance & Verification Setup

This document outlines the test suites, verification scripts, health inspection endpoints, and validation workflows available across **AURA LMS**.

---

## 1. Test Strategy Overview

The testing infrastructure for AURA LMS relies on **TypeScript-executed integration suites** that validate live HTTP requests against a running Express backend and PostgreSQL database. These suites simulate authentic browser and API client interactions across Student, Faculty, and Admin personas.

---

## 2. Dedicated Test Scripts (`backend/src/scripts/`)

| Script | Purpose | Execution Command |
| :--- | :--- | :--- |
| **`comprehensive-system-audit.ts`** | 837-line end-to-end integration test suite covering 17 testing phases (Auth, RAG, RBAC, IDOR, Quizzes, Progress, Analytics). | `npx ts-node src/scripts/comprehensive-system-audit.ts` |
| **`test-phase2-rag.ts`** | Validates PDF text ingestion, automatic 3072-dim Gemini embeddings generation, pgvector cosine search, and citation mapping. | `npm run test:rag` |
| **`test-ai-tutor-audit.ts`** | Verifies thread isolation, course switching in chat, follow-up queries, and anti-hallucination guardrails. | `npx ts-node src/scripts/test-ai-tutor-audit.ts` |
| **`test-phase3a-security.ts`** | Tests RBAC role boundaries and IDOR cross-student access isolation (verifies `403 Forbidden` on unauthorized queries). | `npx ts-node src/scripts/test-phase3a-security.ts` |
| **`test-phase3b-progress.ts`** | Tests protected PDF file streaming (`/api/materials/:id/file`) and reading progress save/restore (`/api/materials/:id/progress`). | `npx ts-node src/scripts/test-phase3b-progress.ts` |
| **`rag-test.ts`** | Performs a direct semantic similarity query against stored course chunks in PostgreSQL. | `npm run rag:test` |
| **`test-db.ts`** | Verifies PostgreSQL connectivity and outputs user and course record counts. | `npm run test:db` |
| **`test-enrollment.js`** | Validates student course enrollment, duplicate rejection (`409`), and enrollment listings. | `node src/scripts/test-enrollment.js` |
| **`verify-api.js`** | Smoke tests key REST API endpoints. | `node src/scripts/verify-api.js` |

---

## 3. Test Matrix & Verification Coverage

Based on the official verification audit [`AURA_LMS_AUDIT.md`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/AURA_LMS_AUDIT.md), the system has passed the following verification phases:

| Phase | Target Subsystem | Test Operation | Expected Result | Verified Status |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 1** | Registration & Auth | `POST /api/auth/register` (New Student) | `201 Created` with JWT | **PASS** |
| **Phase 1** | Auth Validation | `POST /api/auth/register` (Duplicate Email) | `409 Conflict` | **PASS** |
| **Phase 1** | Security Guard | `POST /api/auth/register` (Role: ADMIN) | `400 Bad Request` | **PASS** |
| **Phase 1** | Credentials | `POST /api/auth/login` (Student, Faculty, Admin) | `200 OK` with valid Bearer token | **PASS** |
| **Phase 1** | Session Check | `GET /api/auth/me` | `200 OK` with sanitized user payload | **PASS** |
| **Phase 2** | AI Session | `POST /api/ai/conversations` | `201 Created` with course-bound ID | **PASS** |
| **Phase 2** | Vector RAG | `POST /api/ai/conversations/:id/messages` | `201 Created` with $\ge 0.70$ similarity citations | **PASS** |
| **Phase 2** | Follow-Up | `POST /api/ai/conversations/:id/messages` | Maintains conversation history context | **PASS** |
| **Phase 2** | Anti-Hallucination | "What is the recipe for chocolate cake?" | Refuses out-of-scope question politely | **PASS** |
| **Phase 3** | Embeddings | Gemini API `gemini-embedding-001` | Generates 3072-dim array | **PASS** |
| **Phase 4** | Database Integrity | Schema & Relation consistency checks | All 16 models resolve with zero schema errors | **PASS** |
| **Phase 5** | Course Catalog | `POST /api/courses/:id/enroll` | Enrolls student; 409 on duplicate | **PASS** |
| **Phase 6** | PDF Streaming | `GET /api/materials/:id/file` | Verifies enrollment; streams binary PDF | **PASS** |
| **Phase 6** | Reading Progress | `PUT & GET /api/materials/:id/progress` | Saves & restores `currentPage`, marks complete | **PASS** |
| **Phase 7** | Assessment Security | `GET /api/quizzes/:id` | Hides correct options and explanations from students | **PASS** |
| **Phase 7** | Scoring & Tagging | `POST /api/quizzes/:id/attempts` | Scores percentage; tags `weakTopicsIdentified` | **PASS** |
| **Phase 8** | Assignments | `POST /submissions` & `PUT /submissions/:id/grade` | Submits solution text/file; grades with feedback | **PASS** |
| **Phase 9** | Diagnostics | `GET /students/:id/weak-topics` & `/recommendations` | Aggregates critical/moderate topics & recs | **PASS** |
| **Phase 10** | Analytics | `GET /analytics/at-risk` & `/analytics/faculty/:id` | Flags HIGH/MEDIUM risk students with intervention | **PASS** |
| **Phase 11** | Admin RBAC | `GET /users` | Accessible to ADMIN; `403` to student/faculty | **PASS** |
| **Phase 12** | IDOR Isolation | Cross-student `/api/students/:otherId/*` | Denied with `403 Forbidden` | **PASS** |
| **Phase 17** | Type Safety | Backend `npm run build` (`tsc`) | `0 errors` | **PASS** |
| **Phase 17** | Frontend Build | Next.js `npm run build` (`next build`) | `29/29 routes compiled successfully` | **PASS** |
| **Phase 17** | Prisma Validation | `npx prisma validate` | `Prisma schema is valid` | **PASS** |

---

## 4. Built-in Demo Credentials

The database can be provisioned at any time via `npm run seed`. Preconfigured demo accounts for all three user roles are:

| Role | Name | Email | Password | Department |
| :--- | :--- | :--- | :--- | :--- |
| **Student** | Harsh Vardhan | `harsh.ce@college.edu` | `Password123` | Computer Engineering |
| **Student** | Ananya Roy | `ananya.ce@college.edu` | `Password123` | Computer Engineering |
| **Faculty** | Dr. Rajesh Sharma | `dr.rajesh@college.edu` | `Password123` | Computer Engineering |
| **Faculty** | Prof. Priya Iyer | `priya.iyer@college.edu` | `Password123` | Computer Engineering |
| **Administrator** | System Administrator | `admin.ce@college.edu` | `Password123` | Computer Engineering |

---

## 5. System Health Check Endpoints

- **`GET /api/health`**: Public endpoint verifying that the Express web application process is responsive.
- **`GET /api/health/db`**: Public endpoint running a query against PostgreSQL via Prisma (`user.count()` and `course.count()`) to verify active database pool connectivity.
