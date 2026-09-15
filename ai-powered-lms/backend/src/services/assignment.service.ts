import prisma from "../lib/prisma.js";
import {
  CreateAssignmentInput,
  SubmitAssignmentInput,
  GradeSubmissionInput,
} from "../types/academic.types.js";

export async function getAssignmentsByCourse(courseId: string, studentId?: string) {
  const assignments = await prisma.assignment.findMany({
    where: { courseId },
    include: {
      submissions: studentId
        ? {
            where: { studentId },
          }
        : true,
      _count: {
        select: {
          submissions: true,
        },
      },
    },
    orderBy: { dueDate: "asc" },
  });

  return assignments;
}

export async function getAssignmentById(assignmentId: string, studentId?: string) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      course: {
        select: {
          id: true,
          code: true,
          title: true,
          facultyId: true,
        },
      },
      submissions: studentId
        ? {
            where: { studentId },
          }
        : {
            include: {
              student: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  enrollmentNo: true,
                },
              },
            },
          },
    },
  });

  if (!assignment) {
    throw Object.assign(new Error("Assignment not found"), { statusCode: 404 });
  }

  return assignment;
}

export async function createAssignment(
  courseId: string,
  input: CreateAssignmentInput,
  facultyId: string,
  role: string
) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) {
    throw Object.assign(new Error("Course not found"), { statusCode: 404 });
  }

  if (role !== "ADMIN" && course.facultyId !== facultyId) {
    throw Object.assign(new Error("Forbidden: You can only create assignments for your own courses"), { statusCode: 403 });
  }

  const { title, description, dueDate, totalPoints } = input;
  if (!title || !description || !dueDate) {
    throw Object.assign(new Error("Assignment title, description, and due date are required"), { statusCode: 400 });
  }

  return await prisma.assignment.create({
    data: {
      courseId,
      title: title.trim(),
      description: description.trim(),
      dueDate: new Date(dueDate),
      totalPoints: totalPoints || 100,
    },
  });
}

export async function updateAssignment(
  assignmentId: string,
  input: Partial<CreateAssignmentInput>,
  userId: string,
  role: string
) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { course: true },
  });

  if (!assignment) {
    throw Object.assign(new Error("Assignment not found"), { statusCode: 404 });
  }

  if (role !== "ADMIN" && assignment.course.facultyId !== userId) {
    throw Object.assign(new Error("Forbidden: You can only update assignments for your own courses"), { statusCode: 403 });
  }

  return await prisma.assignment.update({
    where: { id: assignmentId },
    data: {
      ...(input.title && { title: input.title.trim() }),
      ...(input.description && { description: input.description.trim() }),
      ...(input.dueDate && { dueDate: new Date(input.dueDate) }),
      ...(input.totalPoints && { totalPoints: input.totalPoints }),
    },
  });
}

export async function deleteAssignment(assignmentId: string, userId: string, role: string) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { course: true },
  });

  if (!assignment) {
    throw Object.assign(new Error("Assignment not found"), { statusCode: 404 });
  }

  if (role !== "ADMIN" && assignment.course.facultyId !== userId) {
    throw Object.assign(new Error("Forbidden: You can only delete assignments for your own courses"), { statusCode: 403 });
  }

  await prisma.assignment.delete({ where: { id: assignmentId } });
  return { message: "Assignment deleted successfully" };
}

export async function submitAssignment(
  assignmentId: string,
  studentId: string,
  input: SubmitAssignmentInput
) {
  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) {
    throw Object.assign(new Error("Assignment not found"), { statusCode: 404 });
  }

  const existing = await prisma.submission.findUnique({
    where: { assignmentId_studentId: { assignmentId, studentId } },
  });

  if (existing) {
    return await prisma.submission.update({
      where: { id: existing.id },
      data: {
        fileUrl: input.fileUrl || existing.fileUrl,
        content: input.content || existing.content,
        submittedAt: new Date(),
        status: "SUBMITTED",
      },
    });
  }

  return await prisma.submission.create({
    data: {
      assignmentId,
      studentId,
      fileUrl: input.fileUrl || `/submissions/${studentId}_${assignmentId}.pdf`,
      content: input.content || "Assignment solution submitted online.",
      status: "SUBMITTED",
    },
  });
}

export async function getSubmissionsByAssignment(assignmentId: string, userId: string, role: string) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { course: true },
  });

  if (!assignment) {
    throw Object.assign(new Error("Assignment not found"), { statusCode: 404 });
  }

  if (role !== "ADMIN" && assignment.course.facultyId !== userId) {
    throw Object.assign(new Error("Forbidden: Access restricted to course instructor"), { statusCode: 403 });
  }

  return await prisma.submission.findMany({
    where: { assignmentId },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          enrollmentNo: true,
          department: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: { submittedAt: "desc" },
  });
}

export async function getSubmissionById(submissionId: string, userId: string, role: string) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      assignment: {
        include: {
          course: true,
        },
      },
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          enrollmentNo: true,
        },
      },
    },
  });

  if (!submission) {
    throw Object.assign(new Error("Submission not found"), { statusCode: 404 });
  }

  // Authorization: Student who submitted, course faculty, or Admin
  if (role === "STUDENT" && submission.studentId !== userId) {
    throw Object.assign(new Error("Forbidden: Access denied to this submission"), { statusCode: 403 });
  }

  if (role === "FACULTY" && submission.assignment.course.facultyId !== userId) {
    throw Object.assign(new Error("Forbidden: Access restricted to course instructor"), { statusCode: 403 });
  }

  return submission;
}

export async function gradeSubmission(
  submissionId: string,
  input: GradeSubmissionInput,
  facultyId: string,
  role: string
) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      assignment: {
        include: { course: true },
      },
    },
  });

  if (!submission) {
    throw Object.assign(new Error("Submission not found"), { statusCode: 404 });
  }

  if (role !== "ADMIN" && submission.assignment.course.facultyId !== facultyId) {
    throw Object.assign(new Error("Forbidden: Only the course instructor can grade submissions"), { statusCode: 403 });
  }

  const { score, feedback } = input;
  if (score === undefined || score < 0) {
    throw Object.assign(new Error("A valid non-negative score is required"), { statusCode: 400 });
  }

  return await prisma.submission.update({
    where: { id: submissionId },
    data: {
      score,
      feedback: feedback?.trim() || null,
      status: "GRADED",
    },
    include: {
      student: {
        select: { id: true, name: true, email: true },
      },
    },
  });
}
