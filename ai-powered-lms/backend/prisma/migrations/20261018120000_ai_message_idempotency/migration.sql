-- Durable AI message idempotency and timeout reconciliation.
CREATE TYPE "AIMessageRequestStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE "AIMessageRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "status" "AIMessageRequestStatus" NOT NULL DEFAULT 'PROCESSING',
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "userMessageId" TEXT,
    "assistantMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIMessageRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AIMessageRequest_userId_idempotencyKey_key"
    ON "AIMessageRequest"("userId", "idempotencyKey");
CREATE INDEX "AIMessageRequest_userId_status_idx"
    ON "AIMessageRequest"("userId", "status");
CREATE INDEX "AIMessageRequest_conversationId_createdAt_idx"
    ON "AIMessageRequest"("conversationId", "createdAt");

ALTER TABLE "AIMessageRequest"
    ADD CONSTRAINT "AIMessageRequest_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIMessageRequest"
    ADD CONSTRAINT "AIMessageRequest_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "AIConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
