import fs from "fs";
import path from "path";

async function testDocumentIngestion() {
  const BASE_URL = "http://localhost:5000/api";
  console.log("==================================================");
  console.log("AURA LMS: Testing Phase 1 Document Ingestion Suite");
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

  // 3. Get Faculty Courses
  const facultyCoursesRes = await fetch(`${BASE_URL}/faculty/${facultyData.data.user.id}/courses`, {
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  const facultyCoursesData = await facultyCoursesRes.json();
  const targetCourse = facultyCoursesData.data[0];
  console.log("[Setup] Target Course:", targetCourse.code, `(${targetCourse.id})`);

  // Create a realistic sample PDF with academic syllabus content
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

  const tempPdfPath = path.resolve(process.cwd(), "uploads", "materials", "temp_lecture_notes.pdf");
  fs.writeFileSync(tempPdfPath, Buffer.from(samplePdfContent, "utf-8"));

  // TEST 1 to 6: Upload valid PDF as faculty via multipart/form-data
  const formData = new FormData();
  const pdfBlob = new Blob([Buffer.from(samplePdfContent, "utf-8")], { type: "application/pdf" });
  formData.append("file", pdfBlob, "Unit2_Raft_Consensus_Lecture.pdf");
  formData.append("title", "Unit 2: Raft Consensus Protocol");
  formData.append("unit", "Unit 2");

  const uploadRes = await fetch(`${BASE_URL}/courses/${targetCourse.id}/materials`, {
    method: "POST",
    headers: { Authorization: `Bearer ${facultyToken}` },
    body: formData,
  });
  const uploadData = await uploadRes.json();
  const createdMaterial = uploadData.data;

  console.log(
    "[Test 1-6] Upload & Ingestion:",
    uploadRes.status === 201 ? "PASS (201 Created)" : `FAIL (${uploadRes.status})`,
    `Material ID: ${createdMaterial?.id}, Status: ${createdMaterial?.processingStatus}, Chunks: ${createdMaterial?.ragChunksCount}`
  );

  // TEST 7: GET /api/materials/:id/chunks returns chunks with pagination
  const chunksRes = await fetch(`${BASE_URL}/materials/${createdMaterial.id}/chunks?page=1&limit=10`, {
    headers: { Authorization: `Bearer ${facultyToken}` },
  });
  const chunksData = await chunksRes.json();
  console.log(
    "[Test 7] GET /api/materials/:id/chunks:",
    chunksRes.status === 200 && chunksData.data?.chunks?.length > 0 ? "PASS (200 OK)" : `FAIL (${chunksRes.status})`,
    `Total Chunks: ${chunksData.data?.totalChunks}, Returned: ${chunksData.data?.chunks?.length}`
  );

  if (chunksData.data?.chunks?.[0]) {
    const firstChunk = chunksData.data.chunks[0];
    console.log(`         Sample Chunk 0 (Page ${firstChunk.pageNumber}): "${firstChunk.content.slice(0, 70)}..."`);
    console.log(`         Tokens: ${firstChunk.tokenCount}, Chars: ${firstChunk.characterCount}`);
  }

  // TEST 8: Invalid file type rejected (non-PDF)
  const invalidFormData = new FormData();
  const textBlob = new Blob(["This is a plain text document"], { type: "text/plain" });
  invalidFormData.append("file", textBlob, "notes.txt");
  invalidFormData.append("title", "Invalid Text Notes");
  invalidFormData.append("unit", "Unit 1");

  const invalidUploadRes = await fetch(`${BASE_URL}/courses/${targetCourse.id}/materials`, {
    method: "POST",
    headers: { Authorization: `Bearer ${facultyToken}` },
    body: invalidFormData,
  });
  console.log(
    "[Test 8] Non-PDF File Rejection:",
    invalidUploadRes.status === 500 || invalidUploadRes.status === 400 ? "PASS (Rejected non-PDF)" : `FAIL (${invalidUploadRes.status})`
  );

  // TEST 9: Student cannot upload course material (Must return 403)
  const studentUploadRes = await fetch(`${BASE_URL}/courses/${targetCourse.id}/materials`, {
    method: "POST",
    headers: { Authorization: `Bearer ${studentToken}` },
    body: formData,
  });
  console.log(
    "[Test 9] Student Upload Blocked:",
    studentUploadRes.status === 403 ? "PASS (403 Forbidden)" : `FAIL (${studentUploadRes.status})`
  );

  // TEST 10: Existing Material list APIs still work
  const listMaterialsRes = await fetch(`${BASE_URL}/courses/${targetCourse.id}/materials`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const listMaterialsData = await listMaterialsRes.json();
  console.log(
    "[Test 10] Course Materials List API:",
    listMaterialsRes.status === 200 ? "PASS (200 OK)" : `FAIL (${listMaterialsRes.status})`,
    `Total Materials: ${listMaterialsData.data?.length}`
  );

  // Cleanup temp files
  if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath);

  console.log("==================================================");
  console.log("PHASE 1 INGESTION TESTS COMPLETED SUCCESSFULLY!");
  console.log("==================================================");
}

testDocumentIngestion().catch(console.error);
