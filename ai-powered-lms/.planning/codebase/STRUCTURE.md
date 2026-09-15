# Project Directory Structure & Organization

This document details the complete filesystem layout, route mappings, component taxonomy, and entrypoints across the **AURA LMS** repository.

---

## 1. High-Level Repository Layout

```
c:\Users\DELL\Desktop\FINAL YEAR\ai-powered-lms/
├── .agents/                      # Agent workflows and GSD skills
│   └── skills/                   # 67 GSD workflow skills
├── .planning/                    # Project planning & codebase maps
│   └── codebase/                 # GSD codebase intelligence artifacts
├── docs/                         # Project technical documentation
│   ├── API.md                    # REST API specifications
│   └── API-TESTING.md            # API verification commands & payloads
├── AURA_LMS_AUDIT.md             # End-to-end system audit & test report
├── AURA_LMS_UI_UX_MOTION_AUDIT.md# Visual design and motion audit report
├── backend/                      # Express + TypeScript + Prisma backend service
└── frontend/                     # Next.js 16 + React 19 + Tailwind v4 UI
```

---

## 2. Backend Directory Layout (`backend/`)

```
backend/
├── prisma/
│   └── schema.prisma             # Primary Prisma schema with 16 models & pgvector
├── src/
│   ├── controllers/              # HTTP request dispatchers
│   │   ├── academic.controller.ts    # Student & faculty academic profile handlers
│   │   ├── ai.controller.ts          # Conversation and message dispatchers
│   │   ├── analytics.controller.ts   # Student, course, faculty & at-risk analytics
│   │   ├── assignment.controller.ts  # Assignment creation, submission & grading
│   │   ├── auth.controller.ts        # Register, login, me endpoints
│   │   ├── course.controller.ts      # Course CRUD & student enrollment
│   │   ├── material.controller.ts    # Material upload, progress, PDF streaming
│   │   ├── profile.controller.ts     # User profile update endpoints
│   │   ├── quiz.controller.ts        # Quiz CRUD, questions, attempt submission
│   │   └── user.controller.ts        # Admin university user management
│   ├── generated/
│   │   └── prisma/               # Generated Prisma client bundle
│   ├── lib/
│   │   ├── param.ts              # Route parameter string sanitizer helper
│   │   └── prisma.ts             # PrismaClient singleton with pg connection pool
│   ├── middleware/
│   │   ├── auth.middleware.ts    # JWT verification & header parsing
│   │   ├── error.middleware.ts   # Centralized error handler
│   │   ├── role.middleware.ts    # RBAC and IDOR student access guard
│   │   └── upload.middleware.ts  # Multer disk storage for PDF documents
│   ├── routes/                   # Route definitions mounted under /api
│   │   ├── ai.routes.ts          # /api/ai
│   │   ├── analytics.routes.ts   # /api/analytics
│   │   ├── assignment.routes.ts  # /api/assignments & /api/submissions
│   │   ├── attempt.routes.ts     # /api/attempts
│   │   ├── auth.routes.ts        # /api/auth
│   │   ├── course.routes.ts      # /api/courses
│   │   ├── faculty.routes.ts     # /api/faculty
│   │   ├── material.routes.ts    # /api/materials
│   │   ├── profile.routes.ts     # /api/profile
│   │   ├── quiz.routes.ts        # /api/quizzes
│   │   ├── student.routes.ts     # /api/students
│   │   └── user.routes.ts        # /api/users
│   ├── scripts/                  # Audits, migrations, and test scripts
│   │   ├── comprehensive-system-audit.ts  # 837-line E2E 17-phase system audit
│   │   ├── test-phase2-rag.ts    # Live PDF upload & vector RAG test suite
│   │   ├── test-ai-tutor-audit.ts# AI Tutor grounding & thread isolation test
│   │   ├── test-phase3a-security.ts # RBAC & IDOR ownership security test
│   │   ├── test-phase3b-progress.ts # PDF binary stream & reading progress test
│   │   ├── seed.ts               # Database seed script for courses, users, notes
│   │   ├── backfill-embeddings.ts# Batch backfills 3072-dim vectors for chunks
│   │   ├── rag-test.ts           # Semantic vector query test against PostgreSQL
│   │   ├── apply-vector-migration.ts
│   │   ├── apply-chunk-migration.ts
│   │   ├── apply-progress-migration.ts
│   │   ├── run-migration.ts
│   │   ├── test-enrollment.js
│   │   ├── test-ingestion.ts
│   │   └── verify-api.js
│   ├── services/                 # Core business & AI logic
│   │   ├── ai/                   # AI subsystem
│   │   │   ├── providers/
│   │   │   │   ├── llm-provider.interface.ts # Abstract LLM provider interface
│   │   │   │   └── provider.registry.ts      # Provider registry singleton
│   │   │   ├── embedding.service.ts   # Vector dimension verification & batching
│   │   │   ├── gemini.provider.ts     # Google GenAI SDK wrapper (gemini-3.7-flash)
│   │   │   ├── rag.service.ts         # pgvector search + prompt construction
│   │   │   └── student-context.service.ts # Sanitized zero-PII profile builder
│   │   ├── academic.service.ts   # Student & faculty queries, weak topics
│   │   ├── ai.service.ts         # Conversation orchestration & persistence
│   │   ├── analytics.service.ts  # KPI aggregation & at-risk classification
│   │   ├── assignment.service.ts # Assignment workflows & submissions
│   │   ├── auth.service.ts       # Password hashing & user validation
│   │   ├── course.service.ts     # Course catalog and enrollment logic
│   │   ├── ingestion.service.ts  # PDF text extraction, chunking & vectorization
│   │   ├── material.service.ts   # Document management, binary streaming, progress
│   │   ├── quiz.service.ts       # Quiz evaluation, attempt scoring, topic tagging
│   │   └── user.service.ts       # Admin user listing & role updates
│   ├── types/
│   │   ├── academic.types.ts     # Data transfer object types
│   │   └── auth.types.ts         # Auth payload & role definitions
│   └── server.ts                 # Express entrypoint, CORS, route mounting
├── uploads/                      # Local uploaded files
│   └── materials/                # Uploaded syllabus PDFs
├── package.json
└── tsconfig.json
```

---

## 3. Frontend Directory Layout (`frontend/`)

```
frontend/
├── app/                          # Next.js 16 App Router
│   ├── (auth)/                   # Authentication group
│   │   ├── login/page.tsx        # Institutional sign-in
│   │   └── register/page.tsx     # Student & faculty registration
│   ├── admin/                    # Administrator portal
│   │   ├── layout.tsx            # Admin layout shell
│   │   ├── page.tsx              # Role redirector to /admin/dashboard
│   │   ├── dashboard/page.tsx    # High-level institutional metrics
│   │   ├── users/page.tsx        # University user roster management
│   │   ├── courses/page.tsx      # System-wide course directory
│   │   ├── faculty/page.tsx      # Faculty members overview
│   │   └── students/page.tsx     # Student body overview
│   ├── faculty/                  # Faculty portal
│   │   ├── layout.tsx            # Faculty layout shell
│   │   ├── page.tsx              # Role redirector to /faculty/dashboard
│   │   ├── dashboard/page.tsx    # Teaching dashboard & quick actions
│   │   ├── courses/              # Course management
│   │   │   ├── page.tsx          # Taught courses list
│   │   │   ├── create/page.tsx   # New course creator
│   │   │   └── [id]/page.tsx     # Course syllabus and roster detail
│   │   ├── materials/page.tsx    # PDF upload and document processing
│   │   ├── quizzes/page.tsx      # Quiz creation and evaluation
│   │   ├── assignments/page.tsx  # Course assignments and submission grading
│   │   ├── analytics/page.tsx    # Course cohort mastery and at-risk students
│   │   ├── students/page.tsx     # Enrolled student roster and search
│   │   └── profile/page.tsx      # Faculty academic profile
│   ├── student/                  # Student portal
│   │   ├── layout.tsx            # Student layout shell
│   │   ├── page.tsx              # Role redirector to /student/dashboard
│   │   ├── dashboard/page.tsx    # Student personal learning overview
│   │   ├── courses/              # Course enrollment
│   │   │   ├── page.tsx          # Available & enrolled courses
│   │   │   └── [id]/page.tsx     # Course unit detail & materials
│   │   ├── materials/page.tsx    # Course notes list with reading progress
│   │   ├── ai-tutor/page.tsx     # Fullscreen AI academic tutor workspace
│   │   ├── quizzes/              # Quizzes & practice
│   │   │   ├── page.tsx          # Active quizzes list & attempts history
│   │   │   └── [id]/page.tsx     # Interactive quiz taking interface
│   │   ├── assignments/page.tsx  # Course assignments & solution submission
│   │   ├── performance/page.tsx  # KPI charts, weak topics, and grade breakdown
│   │   ├── recommendations/page.tsx # Targeted study recommendations
│   │   └── profile/page.tsx      # Student profile & enrollment credentials
│   ├── favicon.ico
│   ├── globals.css               # Tailwind v4, design tokens, motion classes
│   ├── layout.tsx                # Root HTML layout with AuthProvider
│   └── page.tsx                  # Public landing page (Hero, features, stats)
├── components/
│   ├── layout/                   # Structural layout components
│   │   ├── DashboardShell.tsx    # Sidebar + Topbar container
│   │   ├── Sidebar.tsx           # Role-aware collapsible sidebar navigation
│   │   └── Topbar.tsx            # User profile dropdown, search, notifications
│   ├── materials/
│   │   └── PDFViewerModal.tsx    # Dynamic PDF.js modal with progress tracking
│   ├── quiz/
│   │   └── QuizGeneratorModal.tsx# Faculty quiz creation modal
│   ├── tutor/
│   │   └── AIChatBox.tsx         # Embedded RAG chat box with source badges
│   └── ui/                       # Reusable design system primitives
│       ├── Badge.tsx             # Semantic badge component
│       ├── CourseCard.tsx        # Academic course card with progress bar
│       ├── EmptyState.tsx        # Empty state with iconography and actions
│       ├── ProgressBar.tsx       # Animated progress bar
│       ├── SkeletonLoader.tsx    # Shimmer loaders (Cards, Tables, Metrics)
│       └── StatCard.tsx          # Metric KPI cards with interactive hover
├── lib/
│   ├── api.ts                    # apiRequest<T>() helper and health checks
│   ├── auth.ts                   # Token storage, decoder, and session management
│   ├── AuthContext.tsx           # React auth context and useAuth hook
│   ├── mock-data.ts              # Fallback preview datasets
│   └── types.ts                  # Shared frontend TypeScript interfaces
├── public/                       # Static public assets
├── package.json
└── tsconfig.json
```

---

## 4. Key Entrypoints & Execution Paths

| Component | Path | Description |
| :--- | :--- | :--- |
| **Backend Server Entrypoint** | [`backend/src/server.ts`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/backend/src/server.ts) | Starts Express, binds middleware, mounts routers, checks `JWT_SECRET` |
| **Database Client Entrypoint** | [`backend/src/lib/prisma.ts`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/backend/src/lib/prisma.ts) | Creates pooled PrismaClient with pgvector support |
| **Frontend Root Layout** | [`frontend/app/layout.tsx`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/frontend/app/layout.tsx) | Encloses entire application in `AuthProvider` |
| **Frontend Public Landing** | [`frontend/app/page.tsx`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/frontend/app/page.tsx) | Renders institutional homepage with role-aware navigation |
| **Client Auth Manager** | [`frontend/lib/AuthContext.tsx`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/frontend/lib/AuthContext.tsx) | Manages authentication tokens and current user state |
| **Client API Requester** | [`frontend/lib/api.ts`](file:///c:/Users/DELL/Desktop/FINAL%20YEAR/ai-powered-lms/frontend/lib/api.ts) | Dispatches authenticated HTTP requests to Express server |
