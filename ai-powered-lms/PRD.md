# AURA LMS Product Requirements

## Product goal

Give university learners one reliable workspace for syllabus materials, practice, feedback, and grounded academic help while giving faculty early visibility into learning risk.

## Users and outcomes

| User | Must be able to | Outcome |
| --- | --- | --- |
| Student | Register against an institutional record, verify email, enroll, study, practice, submit work, and ask course-grounded questions | Understand course progress and next study actions |
| Faculty | Apply for approval, manage assigned courses/materials, create assessments, grade work, and inspect analytics | Deliver content and intervene before students fall behind |
| Admin | Provision student records, approve faculty, manage users/courses, and inspect health | Keep institutional identity and access trustworthy |

## Product requirements

### Identity and account lifecycle

- Public registration can create student applications or pending faculty applications, never public admins.
- Student activation requires a matching active institutional registry record and one-time email verification.
- Login returns a sanitized user and a short-lived signed access token only for active accounts; it also establishes a rotating HttpOnly refresh session.
- Password reset uses a generic request response, a hashed expiring token, a single-use update, and reset-request rate limiting.
- Logout clears the browser session and revokes the current refresh session. Existing access tokens remain valid until expiry.

### Learning and AI

- Course access and material files are authorization-scoped.
- PDF text is chunked and embedded for course-scoped retrieval.
- Tutor answers include retrieved source metadata and do not receive student identity fields in pedagogical context.
- Quizzes hide answer keys before submission; scoring and weak-topic tagging happen on the server.

### Trust and reliability

- API errors use a stable `{ success, message }` shape without production stack traces.
- User-facing forms provide labels, loading feedback, and safe error messages.
- Secrets stay in backend environment variables; `NEXT_PUBLIC_*` values are public configuration only.

## Non-goals for the current release

- Automatically adding PostgreSQL RLS without confirming the deployment connection model.
- Product analytics, Sentry, onboarding, legal copy, and automated infrastructure backups before their data-retention and deployment owners are decided.

## Success criteria

1. A registered student can verify email and sign in without exposing password or token material in API responses.
2. An active user can request a password reset without account enumeration and can use the link exactly once before expiry.
3. Existing authorization and AI smoke checks remain green after the account-lifecycle change.
4. A new contributor can run the project using the root README and setup guide.

## Roadmap

1. Production security and account lifecycle: password reset, authentication review, secret audit, backups, deletion policy.
2. UX reliability: loading, empty/error states, shared validation, mobile audit, branded 404.
3. Trust and observability: privacy/terms review, accessibility audit, error tracking, consent-aware analytics.
4. Onboarding after authentication and core UX are stable.
