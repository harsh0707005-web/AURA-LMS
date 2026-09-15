import "dotenv/config";
import prisma from "../lib/prisma.js";
import { ragService } from "../services/ai/rag.service.js";

async function runRAGTest() {
  console.log("==========================================");
  console.log("AURA LMS: REAL VECTOR RAG DIAGNOSTIC TEST");
  console.log("==========================================");

  // 1. Find a course that has materials and document chunks
  const coursesWithChunks = await prisma.$queryRawUnsafe<
    Array<{ courseId: string; code: string; title: string; chunkCount: number }>
  >(`
    SELECT 
      c.id AS "courseId",
      c.code,
      c.title,
      COUNT(dc.id)::int AS "chunkCount"
    FROM "Course" c
    JOIN "Material" m ON m."courseId" = c.id
    JOIN "DocumentChunk" dc ON dc."materialId" = m.id
    WHERE dc.embedding IS NOT NULL
    GROUP BY c.id, c.code, c.title
    ORDER BY "chunkCount" DESC
    LIMIT 1;
  `);

  if (coursesWithChunks.length === 0) {
    console.log("No courses found with embedded chunks. Please run 'npm run embeddings:backfill' or upload a PDF first.");
    await prisma.$disconnect();
    return;
  }

  const targetCourse = coursesWithChunks[0];
  console.log(`[Target Course] ${targetCourse.code}: ${targetCourse.title}`);
  console.log(`[Available Embedded Chunks] ${targetCourse.chunkCount}\n`);

  const testQuestion = "How does Raft elect a leader and prevent split votes?";
  console.log(`[Test Query] "${testQuestion}"\n`);
  console.log("Generating query embedding & executing pgvector cosine search (<=>)...");

  const results = await ragService.retrieveRelevantChunks(testQuestion, targetCourse.courseId, {
    topK: 5,
    minSimilarity: 0.4,
  });

  console.log(`Found ${results.length} relevant chunk(s):\n`);

  results.forEach((r, idx) => {
    console.log(`--- Result #${idx + 1} ---`);
    console.log(`Document:    ${r.documentName} (${r.unit})`);
    console.log(`Page:        ${r.pageNumber ?? "N/A"}`);
    console.log(`Similarity:  ${(r.similarity * 100).toFixed(1)}% (Distance: ${r.distance.toFixed(4)})`);
    console.log(`Tokens:      ${r.tokenCount}`);
    console.log(`Excerpt:     "${r.content.slice(0, 150).replace(/\n/g, " ")}..."\n`);
  });

  // Test full grounded completion with Gemini
  console.log("Generating full grounded answer with Gemini LLM...");
  const groundedResponse = await ragService.generateGroundedTutorResponse(
    testQuestion,
    { code: targetCourse.code, title: targetCourse.title },
    results
  );

  console.log("\n[GEMINI GROUNDED ANSWER]:");
  console.log("------------------------------------------");
  console.log(groundedResponse.answer);
  console.log("------------------------------------------");
  console.log(`\n[Sources Cited]: ${groundedResponse.sources.length} sources`);
  groundedResponse.sources.forEach((s, idx) => {
    console.log(`  [${idx + 1}] ${s.documentName} (Page ${s.page}) - Score: ${s.score}`);
  });

  console.log("\n==========================================");
  console.log("RAG DIAGNOSTIC TEST COMPLETED SUCCESSFULLY!");
  console.log("==========================================");

  await prisma.$disconnect();
}

runRAGTest().catch((err) => {
  console.error("RAG Test Error:", err);
  process.exit(1);
});
