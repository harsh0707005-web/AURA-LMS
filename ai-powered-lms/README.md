# AURA LMS

AURA LMS is an AI-powered university learning management system for the Computer Engineering department. It combines course materials, assessments, progress tracking, role-based academic workflows, and a course-grounded AI tutor.

## Current product scope

- Students: enroll in courses, read protected PDF materials, submit assignments, take quizzes, review performance, and use the course-scoped AI Tutor.
- Faculty: manage courses and materials, create quizzes, grade submissions, and review cohort analytics.
- Administrators: manage institutional student records, review faculty applications, manage users, and oversee courses.
- Authentication: institutional registration, email verification, JWT login, logout, and one-time password reset.
- AI: Gemini embeddings and generation with PostgreSQL/pgvector retrieval; optional Groq generation failover.

Production hardening is staged. Refresh-token rotation and account-lifecycle protections are implemented; shared rate limiting, automated backups, privacy/legal pages, error tracking, analytics, onboarding, and RLS remain explicit follow-up decisions rather than implied features.

## Stack

- Frontend: Next.js App Router, React, TypeScript, Tailwind CSS v4.
- Backend: Node.js, Express 5, TypeScript.
- Data: PostgreSQL with pgvector, Prisma 7, and a pooled `pg` adapter.
- AI and files: Google Gemini, optional Groq, PDF parsing, local or S3-compatible object storage.

## Repository layout

```text
frontend/                 Next.js application
backend/                  Express API, Prisma schema, migrations, smoke tests
docs/API.md               API contract and endpoint reference
.planning/                Existing project planning and codebase notes
```

## Quick start

1. Install Node.js 20 or newer and PostgreSQL with pgvector.
2. Copy `backend/.env.example` to `backend/.env` and fill in local values.
3. Copy `frontend/.env.example` to `frontend/.env.local`.
4. Install dependencies in both `backend/` and `frontend/`.
5. Apply Prisma migrations from `backend/`.
6. Start the backend and frontend in separate terminals.

Detailed setup, environment variables, seed data, email delivery, and migrations are in [`docs/SETUP.md`](docs/SETUP.md).

## Commands

### Backend (`cd backend`)

```bash
npm run build
npm run test:security
npm run test:registration
npm run start
```

### Frontend (`cd frontend`)

```bash
npm run lint
npm run build
npm run dev
```

## Documentation map

- [Product requirements](PRD.md)
- [Architecture](ARCHITECTURE.md)
- [Database](DATABASE.md)
- [Security](SECURITY.md)
- [Setup](docs/SETUP.md)
- [API](docs/API.md)
- [Testing](docs/TESTING.md)
- [Implementation status](docs/IMPLEMENTATION.md)
- [Debugging](docs/DEBUGGING.md)
- [Design system](DESIGN.md)
- [Deployment](DEPLOYMENT.md)
- [Agent and contributor rules](AGENTS.md)

Documentation describes the implementation that exists today. Planned work is labelled as planned; it is not presented as shipped behavior.
