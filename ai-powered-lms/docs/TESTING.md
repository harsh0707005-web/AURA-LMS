# Testing Guide

## Automated checks

| Area | Command | Notes |
| --- | --- | --- |
| Backend TypeScript | `cd backend && npm run build` | Compiles services, controllers, migrations-facing code, and smoke tests |
| Security smoke tests | `cd backend && npm run test:security` | Authorization, provider, retrieval, and security-oriented smoke coverage |
| Registration/auth smoke tests | `cd backend && npm run test:registration` | Registration, verification, login, and account lifecycle boundaries |
| Frontend lint | `cd frontend && npm run lint` | ESLint and Next.js rules |
| Frontend production build | `cd frontend && npm run build` | App Router type/build validation |
| Backup/email regression tests | `cd backend && npm run build && node --test dist/smoke/backup.smoke.js dist/smoke/email-config.smoke.js` | No production writes or real email; included in security suite |
| Isolated local restore drill | `cd backend && npm run test:restore:local` | Explicit confirmation and private snapshot paths required; creates a new local test database/files copy, never overwrites source; see DATABASE.md |
| Restored account services | `cd backend && npm run test:restore:auth` | Explicit test-database target/confirmation; writes synthetic data only there; no mail sent |

## Manual account checklist

- Register an eligible student and verify the emailed fragment link.
- Confirm an unverified or pending faculty account cannot log in.
- Request reset for both a known and unknown email and compare the response.
- Use a reset link once, retry it, and try an expired token.
- Confirm reset-request rate limiting returns `429` after the configured threshold.
- Confirm a disabled account cannot use an existing JWT.
- Check that browser storage contains no password or reset token after the flow.

## Authorization and data safety

Test student cross-record access, faculty/admin boundaries, protected PDF streaming, quiz answer-key omission, AI conversation ownership, and idempotency-key reuse. Use synthetic accounts and documents only. Never put real student records or provider secrets in fixtures or logs.

## Responsive/accessibility checklist

Verify 320px, 375px, 768px, and 1024px layouts; keyboard navigation; visible focus; labels and error association; contrast; reduced motion; and screen-reader status messages for loading, errors, and success.

## Known gaps

The Node smoke suite runs in CI. There is no browser automation suite, production restore test, or dedicated visual regression suite. A local database/files drill exists, but it does not prove off-machine durability or real email delivery. Missing source files cause a failed recovery result even when every existing file was copied correctly.
