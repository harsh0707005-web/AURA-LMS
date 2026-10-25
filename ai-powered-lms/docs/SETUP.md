# Local Setup

## Prerequisites

- Node.js 20+
- PostgreSQL with the pgvector extension
- A database created for AURA LMS
- Optional for local development: Resend, Gemini, Groq, and S3-compatible credentials. Production requires the providers used by the enabled features.

## Install

```bash
cd backend && npm install
cd ../frontend && npm install
```

Create `backend/.env` from `backend/.env.example` and `frontend/.env.local` from `frontend/.env.example`. Keep real values out of git.

## Database

From `backend/`:

```bash
npx prisma generate
npx prisma migrate dev
# Optional local/demo data only:
npm run seed
```

The migrations add `PasswordResetToken` and `RefreshSession`. Existing databases must apply both before using password reset or the hardened login/refresh flow.

## Email

Set `RESEND_API_KEY`, `VERIFICATION_EMAIL_FROM`, and a safe `FRONTEND_URL` to enable verification and password-reset delivery. Development permits localhost HTTP; production requires HTTPS. Without these values, the API keeps responses generic but cannot deliver links.

Put credentials directly in ignored `backend/.env`, never in chat or committed files. Run `npm run check:email` from `backend/`. A successful configuration check proves only presence/URL syntax, not a working key or verified sender. Real delivery requires an approved sender and a synthetic test recipient; provider acceptance is not proof of inbox arrival. No credentials or sender domain were provisioned by the local restore work.

## Production configuration validation

With `NODE_ENV=production`, the backend fails fast before listening if `FRONTEND_URL` is not an HTTPS origin, `DATABASE_URL` is missing or not PostgreSQL, `JWT_SECRET` is weak or shorter than 32 characters, `ACCESS_TOKEN_EXPIRES_IN` is missing or longer than one hour, email credentials are incomplete, Gemini is not configured, or S3-compatible storage is not enabled and configured. Set `DEFAULT_LLM_PROVIDER=groq` only when `GROQ_API_KEY` is also present. Use the canonical S3 variables `S3_ENABLED`, `S3_BUCKET_NAME`, `S3_REGION`, `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE`, and `S3_DELIVERY_MODE`.

The demo seed is blocked when `NODE_ENV=production`. Use an approved provisioning workflow for production accounts and data.

## Run

```bash
# terminal 1, from backend/
npm run dev

# terminal 2, from frontend/
npm run dev
```

The default services are `http://localhost:5000` and `http://localhost:3000`.

## Verification

Run `npm run build`, `npx prisma validate`, `npm run test:security`, and `npm run test:registration` in `backend/`, then `npm run lint` and `npm run build` in `frontend/`. AI, email, S3, and database integration checks require their corresponding local services and credentials. The same checks run in `.github/workflows/ci.yml`.
