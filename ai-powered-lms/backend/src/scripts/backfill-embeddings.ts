import "dotenv/config";
import prisma from "../lib/prisma.js";
import { embeddingService } from "../services/ai/embedding.service.js";

async function backfillEmbeddings() {
  console.log("==========================================");
  console.log("AURA LMS: Document Chunks Embedding Backfill");
  console.log("==========================================");

  // 1. Find all chunks where embedding is NULL
  const unembeddedChunks = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      chunkIndex: number;
      materialId: string;
      content: string;
      pageNumber: number | null;
      documentName: string;
    }>
  >(`
    SELECT 
      dc.id,
      dc."chunkIndex",
      dc."materialId",
      dc.content,
      dc."pageNumber",
      m.title AS "documentName"
    FROM "DocumentChunk" dc
    JOIN "Material" m ON m.id = dc."materialId"
    WHERE dc.embedding IS NULL
    ORDER BY dc."materialId", dc."chunkIndex" ASC;
  `);

  const total = unembeddedChunks.length;
  console.log(`Found ${total} unembedded chunk(s) in PostgreSQL.`);

  if (total === 0) {
    console.log("All existing document chunks already have vector embeddings. No backfill needed.");
    await prisma.$disconnect();
    return;
  }

  let completed = 0;
  let failed = 0;

  for (let i = 0; i < total; i++) {
    const chunk = unembeddedChunks[i];
    console.log(`Embedding chunk ${i + 1}/${total} (Doc: "${chunk.documentName}", Page ${chunk.pageNumber ?? 1})...`);

    try {
      const vector = await embeddingService.embedText(chunk.content);
      const vectorLiteral = embeddingService.toVectorLiteral(vector);

      await prisma.$executeRawUnsafe(
        `UPDATE "DocumentChunk"
         SET embedding = $1::vector, "updatedAt" = NOW()
         WHERE id = $2;`,
        vectorLiteral,
        chunk.id
      );

      completed++;
    } catch (err: any) {
      console.error(`[ERROR] Failed to embed chunk ${chunk.id}:`, err?.message || err);
      failed++;
    }
  }

  console.log("==========================================");
  console.log(`Embedding Backfill Summary:`);
  console.log(`Total Found: ${total}`);
  console.log(`Completed:   ${completed}`);
  console.log(`Failed:      ${failed}`);
  console.log("==========================================");

  await prisma.$disconnect();
}

backfillEmbeddings().catch((err) => {
  console.error("Backfill execution error:", err);
  process.exit(1);
});
