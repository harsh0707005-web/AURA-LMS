import assert from "node:assert/strict";
import test from "node:test";
import { Readable } from "node:stream";
import prisma from "../lib/prisma.js";
import { getMaterialChunks, getMaterialFile } from "../services/material.service.js";
import { submitAssignment, gradeSubmission } from "../services/assignment.service.js";
import { storageService } from "../services/storage/storage.service.js";

const course = { id: "course-1", code: "CS101", title: "Intro to CS", facultyId: "faculty-owner" };
const material = {
  id: "material-1",
  title: "Lecture 1 Notes",
  unit: "Unit 1",
  fileType: "pdf",
  fileSize: "1.2 MB",
  fileUrl: "materials/courses/course-1/material-1/lecture1.pdf",
  courseId: "course-1",
  ragChunksCount: 2,
  course,
};
const assignment = {
  id: "assignment-1",
  courseId: "course-1",
  title: "Assignment 1",
  description: "Problem set 1",
  dueDate: new Date(Date.now() + 86400000),
  totalPoints: 100,
  course,
};

function createReplacer(t: any) {
  return (target: any, method: string, implementation: (...args: any[]) => any) => {
    const original = target[method];
    target[method] = implementation;
    t.after(() => {
      target[method] = original;
    });
    return {
      mockImplementation(newImpl: (...args: any[]) => any) {
        target[method] = newImpl;
      },
    };
  };
}

test("Material chunks endpoint enforces active student enrollment, faculty ownership, and admin deny policy", async (t) => {
  const replace = createReplacer(t);

  let currentUserRole = "STUDENT";
  let currentEnrollment: any = { status: "ACTIVE" };
  let currentMaterial: any = material;

  replace(prisma.user, "findUnique", async () => ({ role: currentUserRole } as any));
  replace(prisma.material, "findUnique", async () => currentMaterial as any);
  replace(prisma.enrollment, "findUnique", async () => currentEnrollment as any);
  replace(prisma.documentChunk, "count", async () => 2);
  replace(prisma.documentChunk, "findMany", async () => [
    { id: "c1", chunkIndex: 0, pageNumber: 1, characterCount: 100, tokenCount: 25, content: "Chunk 1", createdAt: new Date() },
    { id: "c2", chunkIndex: 1, pageNumber: 2, characterCount: 120, tokenCount: 30, content: "Chunk 2", createdAt: new Date() },
  ] as any);

  // 1. Unenrolled student denied access to material chunks (403)
  currentUserRole = "STUDENT";
  currentEnrollment = null;
  await assert.rejects(
    getMaterialChunks("material-1", "student-unenrolled", "STUDENT"),
    { statusCode: 403 }
  );

  // 2. Dropped student denied access to material chunks (403)
  currentEnrollment = { status: "DROPPED" };
  await assert.rejects(
    getMaterialChunks("material-1", "student-dropped", "STUDENT"),
    { statusCode: 403 }
  );

  // 3. Non-owning faculty denied access to material chunks (403)
  currentUserRole = "FACULTY";
  await assert.rejects(
    getMaterialChunks("material-1", "faculty-stranger", "FACULTY"),
    { statusCode: 403 }
  );

  // 4. Admin denied access under consistent deny-by-default course content policy (403)
  currentUserRole = "ADMIN";
  await assert.rejects(
    getMaterialChunks("material-1", "admin-1", "ADMIN"),
    { statusCode: 403 }
  );

  // 5. Caller role differing from database role is rejected (403)
  currentUserRole = "FACULTY";
  await assert.rejects(
    getMaterialChunks("material-1", "tampered-user", "STUDENT"),
    { statusCode: 403 }
  );

  // 6. Missing material returns 404
  currentUserRole = "STUDENT";
  currentEnrollment = { status: "ACTIVE" };
  currentMaterial = null;
  await assert.rejects(
    getMaterialChunks("missing-material", "student-1", "STUDENT"),
    { statusCode: 404 }
  );
  currentMaterial = material;

  // 7. Authorized active student retains legitimate access (200)
  currentUserRole = "STUDENT";
  currentEnrollment = { status: "ACTIVE" };
  const studentChunks = await getMaterialChunks("material-1", "student-active", "STUDENT");
  assert.equal(studentChunks.materialId, "material-1");
  assert.equal(studentChunks.totalChunks, 2);
  assert.equal(studentChunks.chunks.length, 2);

  // 8. Course-owning faculty retains legitimate access (200)
  currentUserRole = "FACULTY";
  const facultyChunks = await getMaterialChunks("material-1", "faculty-owner", "FACULTY");
  assert.equal(facultyChunks.materialId, "material-1");
  assert.equal(facultyChunks.totalChunks, 2);
});

test("Material file access enforces active enrollment and faculty ownership, blocking dropped students and unrelated faculty", async (t) => {
  const replace = createReplacer(t);

  let currentUserRole = "STUDENT";
  let currentEnrollment: any = { status: "ACTIVE" };
  let currentMaterial: any = material;

  replace(prisma.user, "findUnique", async () => ({ role: currentUserRole } as any));
  replace(prisma.material, "findUnique", async () => currentMaterial as any);
  replace(prisma.enrollment, "findUnique", async () => currentEnrollment as any);
  replace(storageService, "getFileStream", async () => ({
    stream: Readable.from(["%PDF-1.7 mock content"]),
    contentLength: 20,
    contentType: "application/pdf",
  }));

  // 1. Unenrolled student denied download (403)
  currentUserRole = "STUDENT";
  currentEnrollment = null;
  await assert.rejects(
    getMaterialFile("material-1", "student-unenrolled", "STUDENT"),
    { statusCode: 403 }
  );

  // 2. Dropped student denied download (403)
  currentEnrollment = { status: "DROPPED" };
  await assert.rejects(
    getMaterialFile("material-1", "student-dropped", "STUDENT"),
    { statusCode: 403 }
  );

  // 3. Non-owning faculty denied download (403)
  currentUserRole = "FACULTY";
  await assert.rejects(
    getMaterialFile("material-1", "faculty-unrelated", "FACULTY"),
    { statusCode: 403 }
  );

  // 4. Role mismatch between parameter and database rejected (403)
  currentUserRole = "FACULTY";
  await assert.rejects(
    getMaterialFile("material-1", "user-tampered", "STUDENT"),
    { statusCode: 403 }
  );

  // 5. Material without fileUrl returns 404
  currentUserRole = "STUDENT";
  currentEnrollment = { status: "ACTIVE" };
  currentMaterial = { ...material, fileUrl: null };
  await assert.rejects(
    getMaterialFile("material-1", "student-active", "STUDENT"),
    { statusCode: 404 }
  );
  currentMaterial = material;

  // 6. Authorized active student retains legitimate access (stream returned)
  currentUserRole = "STUDENT";
  currentEnrollment = { status: "ACTIVE" };
  const studentFile = await getMaterialFile("material-1", "student-active", "STUDENT");
  assert.equal(studentFile.title, "Lecture 1 Notes");
  assert.ok(studentFile.stream);

  // 7. Course-owning faculty retains legitimate access (stream returned)
  currentUserRole = "FACULTY";
  const facultyFile = await getMaterialFile("material-1", "faculty-owner", "FACULTY");
  assert.equal(facultyFile.title, "Lecture 1 Notes");
  assert.ok(facultyFile.stream);

  // 8. Admin retains institutional oversight access
  currentUserRole = "ADMIN";
  const adminFile = await getMaterialFile("material-1", "admin-1", "ADMIN");
  assert.equal(adminFile.title, "Lecture 1 Notes");
  assert.ok(adminFile.stream);
});

test("Assignment submission enforces student role and active enrollment, and prevents URL fabrication", async (t) => {
  const replace = createReplacer(t);

  let currentUserRole = "STUDENT";
  let currentEnrollment: any = { status: "ACTIVE" };
  let currentAssignment: any = assignment;
  let existingSubmission: any = null;
  let createdSubmissionData: any = null;
  let updatedSubmissionData: any = null;

  replace(prisma.user, "findUnique", async () => ({ role: currentUserRole } as any));
  replace(prisma.assignment, "findUnique", async () => currentAssignment as any);
  replace(prisma.enrollment, "findUnique", async () => currentEnrollment as any);
  replace(prisma.submission, "findUnique", async () => existingSubmission);
  replace(prisma.submission, "create", async ({ data }: any) => {
    createdSubmissionData = data;
    return { id: "sub-1", ...data };
  });
  replace(prisma.submission, "update", async ({ data }: any) => {
    updatedSubmissionData = data;
    return { id: existingSubmission?.id || "sub-1", ...data };
  });

  // 1. Unenrolled student denied assignment submission (403)
  currentUserRole = "STUDENT";
  currentEnrollment = null;
  await assert.rejects(
    submitAssignment("assignment-1", "student-unenrolled", { content: "My work" }, "STUDENT"),
    { statusCode: 403 }
  );

  // 2. Dropped student denied assignment submission (403)
  currentEnrollment = { status: "DROPPED" };
  await assert.rejects(
    submitAssignment("assignment-1", "student-dropped", { content: "My work" }, "STUDENT"),
    { statusCode: 403 }
  );

  // 3. Faculty role denied assignment submission at service layer (403)
  currentEnrollment = { status: "ACTIVE" };
  currentUserRole = "FACULTY";
  await assert.rejects(
    submitAssignment("assignment-1", "faculty-1", { content: "My work" }, "FACULTY"),
    { statusCode: 403 }
  );

  // 4. Admin role denied assignment submission at service layer (403)
  currentUserRole = "ADMIN";
  await assert.rejects(
    submitAssignment("assignment-1", "admin-1", { content: "My work" }, "ADMIN"),
    { statusCode: 403 }
  );

  // 5. Database role differing from STUDENT is rejected even if caller claims STUDENT (403)
  currentUserRole = "FACULTY";
  await assert.rejects(
    submitAssignment("assignment-1", "faculty-disguised", { content: "My work" }, "STUDENT"),
    { statusCode: 403 }
  );

  // 6. Missing assignment returns 404
  currentUserRole = "STUDENT";
  currentAssignment = null;
  await assert.rejects(
    submitAssignment("missing-assignment", "student-active", { content: "My work" }, "STUDENT"),
    { statusCode: 404 }
  );
  currentAssignment = assignment;

  // 7. Empty submission (no text content and no fileUrl) rejected (400)
  await assert.rejects(
    submitAssignment("assignment-1", "student-active", {}, "STUDENT"),
    { statusCode: 400 }
  );
  await assert.rejects(
    submitAssignment("assignment-1", "student-active", { content: "   ", fileUrl: "" }, "STUDENT"),
    { statusCode: 400 }
  );

  // 8. Authorized student submission without file does NOT fabricate a dummy URL
  createdSubmissionData = null;
  const textSubmission = await submitAssignment(
    "assignment-1",
    "student-active",
    { content: "Implemented Dijkstra's algorithm in TypeScript." },
    "STUDENT"
  );
  assert.equal(textSubmission.status, "SUBMITTED");
  assert.equal(createdSubmissionData.content, "Implemented Dijkstra's algorithm in TypeScript.");
  assert.equal(createdSubmissionData.fileUrl, null, "Must NOT fabricate /submissions/... URL");

  // 9. Authorized student submission with fileUrl preserves the real fileUrl
  createdSubmissionData = null;
  const fileSubmission = await submitAssignment(
    "assignment-1",
    "student-active-2",
    { content: "Solution attached.", fileUrl: "submissions/courses/course-1/assignment-1/sol.pdf" },
    "STUDENT"
  );
  assert.equal(fileSubmission.status, "SUBMITTED");
  assert.equal(createdSubmissionData.fileUrl, "submissions/courses/course-1/assignment-1/sol.pdf");

  // 10. Existing submission update preserves legitimate workflow
  existingSubmission = { id: "sub-existing", fileUrl: "orig.pdf", content: "Original" };
  updatedSubmissionData = null;
  const resubmission = await submitAssignment(
    "assignment-1",
    "student-active",
    { content: "Updated answer v2" },
    "STUDENT"
  );
  assert.equal(resubmission.status, "SUBMITTED");
  assert.equal(updatedSubmissionData.content, "Updated answer v2");
  assert.equal(updatedSubmissionData.fileUrl, "orig.pdf");
});

test("Assignment grading enforces instructor ownership and preserves grading behavior", async (t) => {
  const replace = createReplacer(t);

  let currentFacultyRole = "FACULTY";
  let currentSubmission: any = {
    id: "sub-1",
    assignmentId: "assignment-1",
    studentId: "student-1",
    status: "SUBMITTED",
    assignment: {
      id: "assignment-1",
      courseId: "course-1",
      course: { id: "course-1", facultyId: "faculty-owner" },
    },
  };

  replace(prisma.user, "findUnique", async () => ({ role: currentFacultyRole } as any));
  replace(prisma.submission, "findUnique", async () => currentSubmission as any);
  replace(prisma.submission, "update", async ({ data }: any) => ({
    ...currentSubmission,
    ...data,
    student: { id: "student-1", name: "Student One", email: "student1@uni.edu" },
  }));

  // 1. Unrelated faculty denied grading permission (403)
  currentFacultyRole = "FACULTY";
  await assert.rejects(
    gradeSubmission("sub-1", { score: 90, feedback: "Good" }, "faculty-stranger", "FACULTY"),
    { statusCode: 403 }
  );

  // 2. Student role denied grading permission (403)
  currentFacultyRole = "STUDENT";
  await assert.rejects(
    gradeSubmission("sub-1", { score: 90 }, "student-1", "STUDENT"),
    { statusCode: 403 }
  );

  // 3. Negative score rejected (400)
  currentFacultyRole = "FACULTY";
  await assert.rejects(
    gradeSubmission("sub-1", { score: -5 }, "faculty-owner", "FACULTY"),
    { statusCode: 400 }
  );

  // 4. Missing submission returns 404
  currentSubmission = null;
  await assert.rejects(
    gradeSubmission("missing-sub", { score: 90 }, "faculty-owner", "FACULTY"),
    { statusCode: 404 }
  );
  currentSubmission = {
    id: "sub-1",
    assignmentId: "assignment-1",
    studentId: "student-1",
    status: "SUBMITTED",
    assignment: {
      id: "assignment-1",
      courseId: "course-1",
      course: { id: "course-1", facultyId: "faculty-owner" },
    },
  };

  // 5. Course-owning faculty successfully grades submission
  const graded = await gradeSubmission(
    "sub-1",
    { score: 95, feedback: "Well structured solution!" },
    "faculty-owner",
    "FACULTY"
  );
  assert.equal(graded.score, 95);
  assert.equal(graded.feedback, "Well structured solution!");
  assert.equal(graded.status, "GRADED");

  // 6. Admin has institutional grading authority
  currentFacultyRole = "ADMIN";
  const adminGraded = await gradeSubmission(
    "sub-1",
    { score: 100, feedback: "Admin regraded" },
    "admin-1",
    "ADMIN"
  );
  assert.equal(adminGraded.score, 100);
  assert.equal(adminGraded.status, "GRADED");
});
