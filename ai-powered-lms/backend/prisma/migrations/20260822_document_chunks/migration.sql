-- CreateTable
CREATE TABLE IF NOT EXISTS "DocumentChunk" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "pageNumber" INTEGER,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "characterCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DocumentChunk_materialId_chunkIndex_key" ON "DocumentChunk"("materialId", "chunkIndex");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DocumentChunk_materialId_idx" ON "DocumentChunk"("materialId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DocumentChunk_pageNumber_idx" ON "DocumentChunk"("pageNumber");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DocumentChunk_materialId_fkey'
  ) THEN
    ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
