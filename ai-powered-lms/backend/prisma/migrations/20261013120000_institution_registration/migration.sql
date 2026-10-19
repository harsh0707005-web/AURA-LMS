-- Additive migration. Existing/demo users retain ACTIVE status.
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'PENDING_EMAIL', 'PENDING_FACULTY_APPROVAL', 'REJECTED', 'DISABLED');
CREATE TYPE "FacultyApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
ALTER TABLE "User" ADD COLUMN "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE', ADD COLUMN "studentRegistryId" TEXT;

CREATE TABLE "StudentRegistry" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "enrollmentNo" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "claimed" BOOLEAN NOT NULL DEFAULT false,
  "claimedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentRegistry_enrollment_normalized" CHECK ("enrollmentNo" = upper(btrim("enrollmentNo")) AND length("enrollmentNo") > 0),
  CONSTRAINT "StudentRegistry_email_normalized" CHECK ("email" = lower(btrim("email")) AND length("email") > 0)
);
CREATE UNIQUE INDEX "StudentRegistry_enrollmentNo_key" ON "StudentRegistry"("enrollmentNo");
CREATE UNIQUE INDEX "StudentRegistry_email_key" ON "StudentRegistry"("email");
CREATE UNIQUE INDEX "User_studentRegistryId_key" ON "User"("studentRegistryId");
ALTER TABLE "User" ADD CONSTRAINT "User_studentRegistryId_fkey" FOREIGN KEY ("studentRegistryId") REFERENCES "StudentRegistry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "FacultyApplication" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "employeeId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "applicantId" TEXT NOT NULL,
  "status" "FacultyApplicationStatus" NOT NULL DEFAULT 'PENDING',
  "reviewerId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FacultyApplication_employee_normalized" CHECK ("employeeId" = upper(btrim("employeeId")) AND length("employeeId") > 0),
  CONSTRAINT "FacultyApplication_email_normalized" CHECK ("email" = lower(btrim("email"))),
  CONSTRAINT "FacultyApplication_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FacultyApplication_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FacultyApplication_employeeId_key" ON "FacultyApplication"("employeeId");
CREATE UNIQUE INDEX "FacultyApplication_email_key" ON "FacultyApplication"("email");
CREATE UNIQUE INDEX "FacultyApplication_applicantId_key" ON "FacultyApplication"("applicantId");
CREATE INDEX "FacultyApplication_status_createdAt_idx" ON "FacultyApplication"("status", "createdAt");

CREATE TABLE "EmailVerificationToken" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");
CREATE INDEX "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");
