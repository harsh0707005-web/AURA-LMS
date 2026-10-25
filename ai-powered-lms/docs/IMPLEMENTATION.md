# Implementation Status

This document is the scope check for the current repository. It records what is actually present in code and tests; planned work is not described as shipped.

## Phase 1 — Production security and account lifecycle

| Area | Status | Evidence / remaining work |
| --- | --- | --- |
| Institutional registration | Implemented | Student registry matching, pending faculty applications, and server-side role protections are covered by registration smoke tests. |
| Email verification | Implemented, integration-dependent | Hashed, expiring, single-use tokens and resend flow exist. A real Resend sender/domain still needs production verification. |
| Password reset | Implemented, integration-dependent | Generic request response, one-hour single-use hashed tokens, bcrypt update, refresh-session invalidation, frontend request/update pages, and smoke coverage exist. |
| Login/logout | Implemented with a documented limit | Short-lived access JWTs, rotating database-backed refresh sessions, HttpOnly cookies, logout revocation, and replay detection exist. Access JWTs are not immediately revocable. |
| API-key exposure audit | Implemented for current frontend | Frontend `NEXT_PUBLIC_*` values are public configuration only; provider, database, storage, email, and JWT secrets remain backend configuration. Re-run the audit before each deployment. |
| Rate limiting | Partial | Authentication and reset endpoints use process-local fixed-window limiters. Redis or another shared store is still needed for multiple API instances. |
| Database/file backups | Local drill performed with a recovery gap | Database and existing-file copies verified; 4 source material references already lack files. See verification below. S3/cloud backup, durable destination, schedule, retention and encryption remain unconfigured. |
| PostgreSQL RLS | Deliberately not enabled | Application-level authorization is present. Revisit only after confirming the production connection/session-user model. |
| Account deletion | Not implemented | Retention, re-authentication, hard-delete/anonymization, academic records, conversations, and object-storage cleanup need a product/legal decision. |

## Phase 2 — UX reliability

| Area | Status | Evidence / remaining work |
| --- | --- | --- |
| Loading states | Partial | Auth, password reset, verification, AI tutor, upload, and several forms expose loading feedback. A page-by-page audit is still needed. |
| Empty states | Partial | Several dashboards and lists handle empty data, but there is no shared empty-state component or complete route audit. |
| Error messages | Partial | Backend production errors are sanitized and frontend forms show safe messages. Error categories and retry behavior are not yet shared consistently. |
| Form validation | Partial | Registration/auth flows validate key fields on both sides; a shared schema layer has not been introduced. |
| Mobile layout/accessibility | Partial | Public landing and many workflows have responsive/focus work, but 320/375/768/1024 manual verification remains. |
| Custom 404 | Implemented | Branded `frontend/app/not-found.tsx` provides home, sign-in, and role-aware dashboard navigation. |

## Phase 3 — Trust and observability

- Privacy policy and terms are **not finalized**. Legal/institutional ownership is required before publishing authoritative copy.
- Email delivery diagnostics include `cd backend && npm run check:email`. Actual delivery still requires deployment credentials and a synthetic test account.
- Accessibility needs a formal manual audit covering keyboard navigation, labels, focus, contrast, announcements, alt text, and captions.
- Error tracking and product analytics are not installed. Do not add them until payload scrubbing, consent, retention, and an owner are defined.

## Phase 4 — Onboarding

Onboarding is not implemented. It should follow authentication and core UX stabilization.

## Verification performed for this status check

From `backend/`: `npm run build`, `npm run test:security`, `npm run test:registration`, and `npx prisma validate`.

From `frontend/`: `npm run lint` and `npm run build`.

All completed successfully. Frontend lint still reports three existing font-loading warnings in `frontend/app/layout.tsx`; they are warnings, not build failures.

### Local backup/restore check — October 24, 2026 (Asia/Calcutta)

- PostgreSQL 18.6 client/server and pgvector available locally; application remains on local storage.
- Created a custom PostgreSQL archive with SHA-256 checksum in a private temporary directory outside the repository. Restored into a newly created local test database, not the application database.
- All 24 public-table row counts matched before synthetic tests; pgvector restored successfully.
- Copied and verified all 13 existing files from the local material storage roots, then verified the restored copy.
- Checked 16 material references: 12 available, **4 missing in the original source too**. Three match demo seed paths; one does not. No records were deleted, and no replacement content was fabricated. The full recovery drill reports failure until the actual missing files are recovered/re-uploaded or their lifecycle is explicitly resolved.
- Real-database service checks passed for pending-account rejection, single-use email verification, login, refresh rotation, logout revocation, single-use password reset, old-password rejection and reset-session revocation. Only synthetic records in the restored database were created; no email was sent.
- Email configuration still lacks `RESEND_API_KEY` and `VERIFICATION_EMAIL_FROM`. Mocked transport tests check link fragments, provider failure, timeout and log redaction, not inbox delivery.
- Backend build and Prisma schema validation passed; security smoke suite passed 63/63 tests, including backup and email regression checks. Frontend was unchanged and was not re-tested in this local-backup pass.
- Source data and `.env` were not changed. Private snapshots, receipt and test database are retained outside Git for review. Temporary same-machine copies are not durable backups; production restore, browser cookie flow, coordinated snapshots and off-machine recovery remain unverified.
