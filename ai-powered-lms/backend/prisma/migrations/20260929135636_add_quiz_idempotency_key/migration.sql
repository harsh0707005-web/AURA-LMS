-- Phase 15 Persistent Idempotency: add idempotencyKey to Quiz
-- This UNIQUE constraint is the database-enforced correctness guarantee.
-- In-memory caching is only an optimisation on top of this constraint.
ALTER TABLE "Quiz" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Quiz_idempotencyKey_key" ON "Quiz"("idempotencyKey");