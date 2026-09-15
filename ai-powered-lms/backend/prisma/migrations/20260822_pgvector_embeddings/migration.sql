-- Ensure pgvector extension is enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable to add embedding column (vector 3072 dimensions)
ALTER TABLE "DocumentChunk" ADD COLUMN IF NOT EXISTS "embedding" vector(3072);
