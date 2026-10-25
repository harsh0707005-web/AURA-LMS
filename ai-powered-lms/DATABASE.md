# AURA LMS Database

## Database

PostgreSQL is accessed through Prisma 7 and `@prisma/adapter-pg`. `DocumentChunk.embedding` uses `vector(3072)` through the pgvector extension. Prisma client output is generated at `backend/src/generated/prisma`.

## Core relationships

- `User` owns enrollments, submissions, quiz attempts, performance, recommendations, material progress, conversations, and faculty courses.
- `StudentRegistry` is the administrator-managed source for eligible student identity claims.
- `FacultyApplication` represents pending faculty review before a user becomes `FACULTY`.
- `EmailVerificationToken` and `PasswordResetToken` store hashes only; raw tokens are delivered through email and never persisted.
- `Course` owns materials, documents, assignments, quizzes, enrollments, analytics, and course conversations.
- `Material` owns extracted `DocumentChunk` rows and student `MaterialProgress` rows.
- `AIConversation` owns `AIMessage` and durable `AIMessageRequest` idempotency records.

## Important status rules

`User.status` is `ACTIVE`, `PENDING_EMAIL`, `PENDING_FACULTY_APPROVAL`, `REJECTED`, or `DISABLED`. Only `ACTIVE` users can log in. Enrollment and assignment/quiz status enums are documented in `backend/prisma/schema.prisma` and should be treated as domain values, not free-form strings.

## Migration process

From `backend/`:

```bash
npx prisma migrate dev --name <short_description>
npx prisma generate
npm run build
```

Review the generated SQL before applying it to shared or production databases. Never edit an already-applied migration; add a new migration instead. Production deploys should use `prisma migrate deploy` after a backup and rollback review.

## Backup and restore

The repository provides manual backup commands and an isolated local restore drill. No schedule, retention pruning, encryption or remote backup service is provisioned. Set `BACKUP_DIR` to an existing private absolute directory **outside the Git repository**. Restrict its OS permissions; use encrypted storage for real records. Windows ACLs must be configured by the operator (POSIX mode bits alone are not an ACL).

From `backend/`, in PowerShell (replace placeholders):

```powershell
$env:BACKUP_DIR="<existing-private-absolute-directory>"
# Custom-format dump, archive-list check, and SHA-256 sidecar.
npm run backup:database

# Local mode: copies uploads/materials and legacy public files with SHA-256 manifest.
# S3 mode: requires a DIFFERENT BACKUP_S3_BUCKET and creates a unique run prefix.
npm run backup:storage

# Use the exact paths printed by the backup commands, not a guessed filename.
$env:BACKUP_FILE="<absolute-path-to-dump>"
$env:STORAGE_BACKUP_DIR="<absolute-path-to-materials-snapshot>"
$env:CONFIRM_LOCAL_DRILL="YES"
npm run test:restore:local

# Select the NEW database name printed by the drill, never change DATABASE_URL.
$env:RESTORE_DATABASE_NAME="<aura_restore_name-printed-by-drill>"
npm run test:restore:auth
```

`test:restore:local` creates a new `aura_restore_*` database on the local PostgreSQL server and a new files directory. It verifies dump checksum, all public-table row counts, pgvector availability, file checksums and material/document references. It invalidates copied refresh/reset/verification sessions only in the test database. It retains the database and private receipt for review; nothing is automatically dropped. `test:restore:auth` inserts a synthetic account only in that selected test database and checks account activation, login, refresh/logout and password reset without sending email.

For a separately created empty test database, `restore:database` requires `BACKUP_FILE`, `RESTORE_DATABASE_NAME` and `CONFIRM_RESTORE=YES`. It refuses remote hosts, application-database targets, nonempty targets and `RESTORE_CLEAN`. It restores in one transaction, without original owners/ACLs. It is **not** a production disaster-recovery command. Restore only trusted archives; checksums detect corruption, not malicious SQL or a maliciously replaced checksum.

Stop application writes while taking a coordinated database/files backup. The two commands do not create an atomic cross-store snapshot. A failed dump remains `.partial`; a local files snapshot without `manifest.json` is incomplete. Do not treat either as a usable backup. S3 copying currently covers `materials/courses/` only and has not been live-tested here; it is not a versioned point-in-time restore solution.

A restore is incomplete unless database records and referenced files are recoverable. Local temporary test copies do not protect against machine/disk loss. Before production, select encrypted off-machine storage, retention and recovery objectives, alerting and an owner, and test the actual production provider's recovery process. Never remove original uploads to make a restore test pass.

## Deletion and retention

Most academic child records use cascade deletion from their owning user/course. A final account-deletion policy is not yet implemented: the project must decide which submissions, audit records, conversations, and uploaded materials are hard-deleted versus anonymized before exposing self-service deletion.

## RLS decision

Application-level RBAC and ownership checks are implemented. PostgreSQL RLS is not enabled. Revisit it if production uses a shared database role or needs defense-in-depth tenant boundaries; do not enable it without verifying Prisma migrations, background jobs, and the connection/session-user model.
