# Contribution and Agent Guide

## Repository rules

- Preserve unrelated working-tree changes; inspect `git status` before editing.
- Keep the existing Next.js/Express/Prisma stack and conventions.
- Never commit `.env`, local uploads, tokens, credentials, or student data.
- Treat `backend/src/generated/prisma` as generated output; update `schema.prisma` and migrations, then run `npx prisma generate`.
- Do not edit an applied migration. Add a new timestamped migration.
- Keep authorization in the backend even when the frontend hides a control.
- User-facing errors must be safe and actionable; no stack traces or provider payloads.

## Feature workflow

1. Read the relevant document and affected route/service/component.
2. Define the user-visible acceptance criteria.
3. Make the smallest complete change, including invalid and failure states.
4. Add or update a smoke test for security-sensitive behavior.
5. Run the narrowest meaningful checks, then review `git diff`.

## Checks

Backend:

```bash
npm run build
npm run test:security
npm run test:registration
```

Frontend:

```bash
npm run lint
npm run build
```

Run commands from their respective folders. A missing database, email provider, or AI credential is a setup gap, not a reason to fake a passing result.

## Security-sensitive changes

For authentication, authorization, file access, AI prompts, or migrations, document the threat boundary and test the negative case. Do not add RLS, refresh-token infrastructure, analytics, or external services without a deployment decision and data-retention owner.
