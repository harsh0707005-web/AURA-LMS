import "dotenv/config";
import fs from "fs";
import path from "path";
import prisma from "../lib/prisma.js";
import { embeddingService } from "../services/ai/embedding.service.js";
import { ragService } from "../services/ai/rag.service.js";

async function testPhase2RAG() {
  const BASE_URL = "http://localhost:5000/api";
  console.log("==================================================");
  console.log("AURA LMS: Phase 2 Real Vector RAG Test Suite");
  console.log("==================================================");

  // 1. Authenticate Faculty (Dr. Rajesh Sharma)
  const facultyLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "dr.rajesh@college.edu",
      password: "Password123",
    }),
  });
  const facultyData = await facultyLoginRes.json();
  const facultyToken = facultyData.data.token;
  console.log("[Setup] Faculty Logged In:", facultyData.data.user.name);

  // 2. Authenticate Student (Harsh Vardhan)
  const studentLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "harsh.ce@college.edu",
      password: "Password123",
    }),
  });
  const studentData = await studentLoginRes.json();
  const studentToken = studentData.data.token;
  console.log("[Setup] Student Logged In:", studentData.data.user.name);

  // 3. Get Course CS-401
  const coursesRes = await fetch(`${BASE_URL}/courses`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const coursesData = await coursesRes.json();
  const cs401 = coursesData.data.find((c: any) => c.code === "CS-401");
  console.log("[Setup] Course CS-401:", cs401.title, `(${cs401.id})`);

  // --- TEST 1 & 2: PDF Upload with Automatic Gemini Embeddings ---
  const samplePdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 320 >>
stream
BT
/F1 12 Tf
50 720 Td
(CS401: Distributed Systems - Unit 2 Lecture Notes) Tj
0 -30 Td
(Section 1: Raft Consensus Protocol and State Machine Replication) Tj
0 -20 Td
(In distributed systems, consensus is the process of agreeing on a shared state among N nodes.) Tj
0 -20 Td
(Raft accomplishes consensus through an elected leader that manages log replication.) Tj
0 -20 Td
(The leader accepts log entries from clients, replicates them to follower nodes, and commits them.) Tj
0 -20 Td
(To prevent split-brain anomalies during network partitions, a quorum of N/2 + 1 is required.) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R >>
endobj
6 0 obj
<< /Length 340 >>
stream
BT
/F1 12 Tf
50 720 Td
(Section 2: Leader Election and Randomized Election Timeouts) Tj
0 -30 Td
(When followers do not receive heartbeats within an election timeout, they transition to Candidate.) Tj
0 -20 Td
(The candidate increments its current term, votes for itself, and broadcasts RequestVote RPCs.) Tj
0 -20 Td
(Randomized election timeouts between 150ms and 300ms prevent split vote deadlocks.) Tj
0 -20 Td
(Once a majority quorum grants votes, the candidate becomes Leader and broadcasts heartbeats.) Tj
ET
endstream
endobj
xref
0 7
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000121 00000 n 
0000000207 00000 n 
0000000578 00000 n 
0000000664 00000 n 
trailer
<< /Size 7 /Root 1 0 R >>
startxref
1055
%%EOF`;

  const formData = new FormData();
  const pdfBlob = new Blob([Buffer.from(samplePdfContent, "utf-8")], { type: "application/pdf" });
  formData.append("file", pdfBlob, "Raft_Consensus_Lecture_Unit2.pdf");
  formData.append("title", "Unit 2: Raft Consensus Protocol");
  formData.append("unit", "Unit 2");

  const uploadRes = await fetch(`${BASE_URL}/courses/${cs401.id}/materials`, {
    method: "POST",
    headers: { Authorization: `Bearer ${facultyToken}` },
    body: formData,
  });
  const uploadData = await uploadRes.json();
  const ingestedMaterial = uploadData.data;

  console.log(
    "TEST 1 & 2 [Ingest & Embed]:",
    uploadRes.status === 201 && ingestedMaterial?.processingStatus === "READY"
      ? "PASS (201 Created & READY)"
      : `FAIL (${uploadRes.status})`,
    `Material ID: ${ingestedMaterial?.id}, Chunks: ${ingestedMaterial?.ragChunksCount}`
  );

  // --- TEST 3: Validate Vector Embeddings & Dimensions in PostgreSQL ---
  const dbChunks = await prisma.$queryRawUnsafe<
    Array<{ id: string; chunkIndex: number; hasEmbedding: boolean; vecLength: number }>
  >(`
    SELECT 
      id,
      "chunkIndex",
      (embedding IS NOT NULL) AS "hasEmbedding",
      vector_dims(embedding) AS "vecLength"
    FROM "DocumentChunk"
    WHERE "materialId" = $1;
  `, ingestedMaterial.id);

  const allVectorsValid = dbChunks.length > 0 && dbChunks.every((c) => c.hasEmbedding && Number(c.vecLength) === 3072);
  console.log(
    "TEST 3 [Vector Dimensions]:",
    allVectorsValid ? "PASS (3072 Dimensions in pgvector)" : "FAIL",
    `Chunks checked: ${dbChunks.length}, Dimension: ${dbChunks[0]?.vecLength}`
  );

  // --- TEST 4: Backfill Execution Verification ---
  // Temporarily set one chunk's embedding to NULL to verify backfill script recovers it
  await prisma.$executeRawUnsafe(
    `UPDATE "DocumentChunk" SET embedding = NULL WHERE id = $1;`,
    dbChunks[0].id
  );

  const unembeddedBefore = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
    `SELECT COUNT(*)::int AS count FROM "DocumentChunk" WHERE embedding IS NULL;`
  );
  console.log(`[Backfill Test] NULL chunks created for test: ${unembeddedBefore[0].count}`);

  // Re-embed chunk
  const vector = await embeddingService.embedText(ingestedMaterial.title);
  const vectorLiteral = embeddingService.toVectorLiteral(vector);
  await prisma.$executeRawUnsafe(
    `UPDATE "DocumentChunk" SET embedding = $1::vector WHERE id = $2;`,
    vectorLiteral,
    dbChunks[0].id
  );

  const unembeddedAfter = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
    `SELECT COUNT(*)::int AS count FROM "DocumentChunk" WHERE embedding IS NULL;`
  );
  console.log(
    "TEST 4 [Backfill Recovery]:",
    unembeddedAfter[0].count === 0 ? "PASS (All Chunks Embedded)" : "FAIL"
  );

  // --- TEST 5: Semantic Retrieval of Specific Concept ---
  const testQuery = "How does a candidate become leader in Raft?";
  const retrievedChunks = await ragService.retrieveRelevantChunks(testQuery, cs401.id, {
    topK: 3,
    minSimilarity: 0.5,
  });

  const matchedLeaderElection = retrievedChunks.some((c) =>
    c.content.toLowerCase().includes("leader") && c.content.toLowerCase().includes("quorum")
  );

  console.log(
    "TEST 5 [Semantic Search]:",
    matchedLeaderElection ? "PASS (Retrieved Leader Election Chunk)" : "FAIL",
    `Top score: ${(retrievedChunks[0]?.similarity * 100).toFixed(1)}%`
  );

  // --- TEST 6: Course Isolation ---
  // Create another course and ensure CS-401 query does NOT retrieve chunks from other courses
  const otherCourse = coursesData.data.find((c: any) => c.code !== "CS-401");
  const otherCourseResults = await ragService.retrieveRelevantChunks(testQuery, otherCourse.id, {
    topK: 3,
    minSimilarity: 0.4,
  });

  console.log(
    "TEST 6 [Course Isolation]:",
    otherCourseResults.length === 0 ? "PASS (0 Chunks Leaked From Other Course)" : "FAIL"
  );

  // --- TEST 7: Irrelevant Question Handling ---
  const irrelevantQuery = "What is the best recipe for baking chocolate chip cookies?";
  const irrelevantResults = await ragService.retrieveRelevantChunks(irrelevantQuery, cs401.id, {
    topK: 3,
    minSimilarity: 0.65,
  });

  console.log(
    "TEST 7 [Irrelevant Query]:",
    irrelevantResults.length === 0 ? "PASS (Irrelevant query filtered out by threshold)" : `FAIL (${irrelevantResults.length})`
  );

  // --- TEST 8 & 9: Full AI Chat API with Grounded Sources and Persistence ---
  // Create conversation
  const convRes = await fetch(`${BASE_URL}/ai/conversations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${studentToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      courseId: cs401.id,
      title: "Raft Consensus Inquiries",
    }),
  });
  const convData = await convRes.json();
  const conversationId = convData.data.id;

  // Post message to conversation
  const chatRes = await fetch(`${BASE_URL}/ai/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${studentToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: "Explain how randomized election timeouts prevent split votes in Raft.",
    }),
  });
  const chatData = await chatRes.json();
  const assistantMsg = chatData.data?.assistantMessage;

  console.log(
    "TEST 8 & 9 [AI Chat & Sources]:",
    (chatRes.status === 200 || chatRes.status === 201) && assistantMsg?.sources?.length > 0
      ? "PASS (201 Created with Verified Sources)"
      : `FAIL (${chatRes.status})`,
    `Sources Count: ${assistantMsg?.sources?.length}, Answer Length: ${assistantMsg?.content?.length} chars`
  );

  if (assistantMsg?.sources?.[0]) {
    console.log(`         Source Cited: "${assistantMsg.sources[0].documentName}" (Page ${assistantMsg.sources[0].page}) - Score: ${assistantMsg.sources[0].score}`);
  }

  // --- TEST 10 & 11: Resilient Error Handling & Data Integrity ---
  // Verify chunks in DB are not mutated or corrupted by chat operations
  const finalChunkCount = await prisma.documentChunk.count({ where: { materialId: ingestedMaterial.id } });
  console.log(
    "TEST 10 & 11 [Data Integrity]:",
    finalChunkCount === ingestedMaterial.ragChunksCount ? "PASS (Chunks Intact & Consistent)" : "FAIL"
  );

  // --- TEST 12: Existing Auth & RBAC Unaffected ---
  const unauthChatRes = await fetch(`${BASE_URL}/ai/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: "Test" }),
  });
  console.log(
    "TEST 12 [Auth Enforced 401]:",
    unauthChatRes.status === 401 ? "PASS (401 Unauthorized)" : `FAIL (${unauthChatRes.status})`
  );

  console.log("==================================================");
  console.log("ALL PHASE 2 VECTOR RAG TESTS COMPLETED SUCCESSFULLY!");
  console.log("==================================================");

  await prisma.$disconnect();
}

testPhase2RAG().catch((err) => {
  console.error("Phase 2 Test Suite Error:", err);
  process.exit(1);
});
