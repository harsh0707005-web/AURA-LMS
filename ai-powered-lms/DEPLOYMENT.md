# AURA LMS Deployment Checklist

## Required production decisions

- HTTPS and a single explicit `FRONTEND_URL` origin.
- PostgreSQL with pgvector and a managed migration process.
- Durable object storage for material PDFs; local disk is development-only.
- Email provider credentials and verified sender for verification and reset mail.
- Secret-manager or encrypted environment configuration.
- Database and object-storage backup schedules, retention, encryption, and restore drills.
- Monitoring for health endpoints, application errors, provider latency, storage failures, and backup freshness.

## Environment

Use `backend/.env.example` as the variable contract and set real values only in the deployment environment. The canonical object-storage variables are `S3_ENABLED`, `S3_BUCKET_NAME`, `S3_REGION`, `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE`, and `S3_DELIVERY_MODE`; `STORAGE_PROVIDER`, `AWS_REGION`, and `AWS_S3_BUCKET` are not used by the current storage layer. `JWT_SECRET`, `DATABASE_URL`, `GEMINI_API_KEY`, S3 credentials, Resend credentials, and any Groq credential are backend-only. The frontend receives only public API URL/configuration.

At startup, `NODE_ENV=production` fails closed unless all of the following are valid: an HTTPS origin-only `FRONTEND_URL`, PostgreSQL `DATABASE_URL`, a non-placeholder `JWT_SECRET` of at least 32 characters, an explicit `ACCESS_TOKEN_EXPIRES_IN` no longer than one hour, Resend credentials, Gemini credentials, and S3-compatible storage. If `DEFAULT_LLM_PROVIDER=groq`, `GROQ_API_KEY` is required too. Explicit AWS credentials must be supplied as a complete pair; an instance or workload identity may be used instead.

## Release steps

1. Build backend and frontend from the same commit.
2. Run `npm run build`, `npx prisma validate`, and the CI smoke tests before release.
3. Run the migration review and take a database backup.
4. Apply `npx prisma migrate deploy` from `backend/`.
5. Deploy the backend, verify `/api/health` and `/api/health/db`, then deploy the frontend.
6. Smoke-test registration/verification or reset, login/logout, role access, a protected material request, and the AI tutor with a test account.
7. Record the release version and rollback target.

## Backup and email verification commands

The repository includes operator-run checks. For this local-only installation, no cloud account or deployment was created:

```bash
cd backend
npm run check:email
npm run backup:database
npm run backup:storage
```

`check:email` checks presence/URL syntax for `RESEND_API_KEY`, `VERIFICATION_EMAIL_FROM`, and `FRONTEND_URL` without sending mail. It does not verify the API key, sender domain or inbox delivery. Database backup requires PostgreSQL client tools. In local mode, file backup covers `uploads/materials` and `public`; set `BACKUP_DIR` to an existing absolute private directory outside the repository. In S3 mode, configure a separate backup bucket and list/read/copy permissions; no live S3 copy was performed. See [DATABASE.md](DATABASE.md) for the isolated restore drill and its safety limits. No recurring schedule is configured.

For production email verification, run `npm run check:email`, then register a synthetic test account, confirm the verification email arrives, open the link, and confirm the account can log in. Repeat with password reset and confirm the reset link is single-use. Do not use real student data for this test.

Never run `npm run seed` against a production environment. The demo seed now exits when `NODE_ENV=production`; provision real administrators and data through an approved operational process.

## Rollback

Prefer rolling application code back while keeping additive migrations compatible. Do not roll back a database migration by deleting rows or editing migration history without an approved recovery procedure. Restore database and object storage together when a data-loss event is involved.

## Remaining external requirements

The repository now includes a minimal GitHub Actions CI workflow for backend build/schema validation/security+registration smoke tests and frontend lint/build. The deployment owner must still provide the production PostgreSQL/pgvector service, private S3-compatible bucket and IAM policy, verified email sender, secret manager, managed execution schedule for backups, restore drills, monitoring/alerting, TLS termination, and a production release/rollback process. CI does not provision these services or prove external provider connectivity.
