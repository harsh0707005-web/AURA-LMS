# AURA LMS Architecture

## Runtime topology

```text
Browser / Next.js 16 (3000)
        │ REST + Bearer JWT
        ▼
Express 5 API (5000)
  security headers → CORS → JSON parsing → route auth/RBAC → controllers → services
        │ Prisma + pg adapter
        ▼
PostgreSQL + pgvector
        │
        ├── local filesystem or S3-compatible material storage
        ├── Resend email delivery (when configured)
        └── Gemini embeddings/generation; optional Groq generation failover
```

## Frontend

`frontend/app` uses Next.js App Router. The root layout installs `AuthProvider`; authenticated role layouts guard `/student`, `/faculty`, and `/admin`. `frontend/lib/api.ts` is the common fetch wrapper and attaches the browser-stored JWT. Public account routes include login, registration, email verification, password-reset request, and password update.

The browser keeps the current access token and sanitized user in React memory only. The refresh token is an HttpOnly cookie scoped to `/api/auth`, so JavaScript cannot read it. A full page reload silently requests a rotated access token when the refresh session is still valid.

## Backend request lifecycle

Routes compose endpoint-specific rate limiting, authentication, role checks, and ownership checks. Controllers translate HTTP input/output; services own validation, transactions, provider calls, and Prisma access. `error.middleware.ts` converts uncaught failures into the common response shape and hides details in production.

## Authentication flow

1. Registration validates institutional identity and stores a bcrypt hash.
2. Student verification consumes a hashed, 24-hour token and claims the registry row.
3. Login checks the password and active status, then signs a short-lived JWT and creates a hashed refresh session.
4. `authenticate` verifies the JWT and re-checks the current database account status.
5. A refresh request consumes the current refresh session exactly once, creates its replacement, and returns a new access token. Reuse detection revokes the user's remaining sessions.
6. Password reset invalidates prior reset tokens, emails only a raw token, consumes it transactionally, updates the bcrypt hash, and invalidates remaining refresh sessions.

Access-token revocation on logout is not immediate; access tokens remain valid until their configured expiry. Account status checks still block disabled accounts on every authenticated request.

## AI tutor flow

The AI service embeds the query, retrieves pgvector chunks restricted to the conversation course, builds a bounded prompt with zero-PII academic context, calls Gemini (with configured fallback behavior), and persists the user/assistant messages plus source references. Durable idempotency records prevent duplicate provider calls for retried message submissions.

## Authorization boundaries

- `STUDENT`, `FACULTY`, and `ADMIN` are database roles.
- Public registration cannot grant `ADMIN` and faculty starts as a pending application.
- Course/material/assignment/quiz services enforce ownership and role rules in addition to route middleware.
- Student-specific endpoints use ownership isolation so one student cannot read another student’s records.
- Material file streaming verifies faculty/admin access or active student enrollment.

## Deployment dependencies

The production topology needs PostgreSQL/pgvector, durable object storage for uploaded materials, HTTPS, a configured email provider, a secret manager/environment, and a backup/restore process. The repository currently contains local-development defaults and does not provision these infrastructure services.
