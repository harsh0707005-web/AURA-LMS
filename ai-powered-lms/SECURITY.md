# AURA LMS Security Guide

## Current controls

- Passwords are bcrypt-hashed with 10 rounds and are never returned by profile endpoints.
- JWT signing requires `JWT_SECRET` at backend startup. In production, the backend also requires a non-placeholder secret of at least 32 characters and an explicit `ACCESS_TOKEN_EXPIRES_IN` no longer than one hour. The API re-checks the database account status on each authenticated request.
- Public registration cannot create administrators; faculty applications remain pending until admin review.
- Email-verification and password-reset tokens are random, SHA-256 hashed at rest, expiring, and single-use.
- Password reset requests return the same message for known and unknown accounts and have a dedicated process-local rate limiter.
- Role authorization and student ownership checks are enforced server-side.
- Security headers disable framing, MIME sniffing, and unnecessary browser capabilities.
- Production error responses do not include stack traces, SQL details, provider errors, or secrets.
- AI pedagogical context excludes names, emails, enrollment numbers, and user IDs.
- Access tokens are short-lived and refresh sessions are stored as SHA-256 hashes, delivered through Secure/HttpOnly cookies, rotated on refresh, revoked on logout, and revoked after password reset. Reuse of a rotated refresh token revokes the user's remaining active sessions. Access JWTs are not blacklisted and remain valid until expiry.

## Secrets and public configuration

Gemini, Groq, database, S3, JWT, and email credentials belong only in backend environment variables or a deployment secret manager. `NEXT_PUBLIC_API_URL` and similar variables are intentionally public; never place a credential in `NEXT_PUBLIC_*`. Run a source audit before deployment:

```bash
git grep -n "NEXT_PUBLIC_\|API_KEY\|JWT_SECRET\|DATABASE_URL" -- ':!backend/.env'
```

The command is an audit aid, not proof that a value is safe. Check the actual environment and build output separately.

Production startup validation also requires an HTTPS origin-only `FRONTEND_URL`, PostgreSQL `DATABASE_URL`, Resend email credentials, Gemini credentials for embeddings/tutor requests, and S3-compatible object storage. Local disk storage is rejected in production. The canonical storage contract is `S3_ENABLED`, `S3_BUCKET_NAME`, `S3_REGION`, `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE`, and `S3_DELIVERY_MODE`; older `STORAGE_PROVIDER`, `AWS_REGION`, and `AWS_S3_BUCKET` names are not part of the contract.

## Authentication operational limits

Production deployments must choose a short access-token lifetime through `ACCESS_TOKEN_EXPIRES_IN` (the validator caps it at one hour). The refresh-session table should be included in database backups, and the deployment must use HTTPS so the refresh cookie remains Secure. If frontend and API are deployed on different sites, review the SameSite policy and add an explicit CSRF design before changing the current `lax` cookie policy.

## Files and PII

Material file access must remain behind enrollment/role checks. Do not log passwords, bearer tokens, reset links, uploaded document contents, AI prompts, or student PII. Error tracking, when added, must scrub these fields and carry only environment/release metadata.

## Rate limiting and operations

The current limiter is process-local and therefore not sufficient for multiple backend instances. Move authentication, reset, and AI quota controls to Redis or another shared store before horizontal scaling. Production must also add secret rotation, database/object-storage backups, restore testing, and monitoring. The demo seed is blocked when `NODE_ENV=production`.

## Account deletion and retention

Self-service deletion is not implemented. Before adding it, define re-authentication, hard-delete/anonymization behavior, retention exceptions, submitted work ownership, conversation handling, and object-storage cleanup.
