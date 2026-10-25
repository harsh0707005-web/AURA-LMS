# Debugging Guide

## Backend does not start

Check Node version, `backend/.env`, `JWT_SECRET`, `DATABASE_URL`, and whether port 5000 is available. The server intentionally fails fast when `JWT_SECRET` is missing.

## Prisma/database errors

From `backend/`, run `npx prisma generate`, inspect migration status, and confirm PostgreSQL plus pgvector are reachable. Apply pending migrations before testing account reset. Do not resolve schema drift by deleting migration history.

## Email verification or password reset

Confirm `FRONTEND_URL` is HTTPS outside local development, the Resend key and sender are configured, and the sender domain is verified. Tokens are stored only as hashes, so links cannot be reconstructed from the database. Use a fresh request rather than copying a token into logs.

## Authentication failures

Use browser network tools to inspect status codes and safe messages only. Check whether the account is `ACTIVE`, whether the JWT is expired, and whether the backend is using the same `JWT_SECRET` that issued the token. A full page reload depends on the HttpOnly refresh cookie; if it fails, check cookie path, HTTPS/SameSite settings, CORS credentials, and the `RefreshSession` migration. Logout revokes the refresh session but does not revoke an already-issued access JWT before its expiry.

## AI/RAG failures

Check Gemini/Groq configuration, embedding dimensions, database vector extension, course authorization, and the bounded provider timeout. Inspect telemetry fields such as stage, model, latency, and error category—not prompts, documents, tokens, or PII.

## Frontend issues

Run `npm run lint` and `npm run build` from `frontend/`. Check `NEXT_PUBLIC_API_URL`, browser console errors, and network CORS responses. For route issues, follow the App Router folder path and ensure a `page.tsx` exists.

## Safe diagnostics

Backup failures deliberately suppress raw PostgreSQL/provider diagnostics because they may include data. Check that `BACKUP_DIR` exists outside the repository, `pg_dump`/`pg_restore` are on PATH and compatible with the server, and the database is reachable. Never restore a `.partial` file. The local restore requires a matching checksum and an empty, separate `aura_restore_*` target. A missing-material result means the database references a file absent from the snapshot; compare with the source, do not manufacture replacement PDFs or delete records to pass the check.

```bash
cd backend && npm run build
cd backend && npm run test:registration
cd frontend && npm run lint
```

Redact environment values and authorization headers from shared output.
