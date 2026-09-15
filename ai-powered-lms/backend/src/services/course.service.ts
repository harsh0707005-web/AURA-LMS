import prisma from "../lib/prisma.js";
import { CreateCourseInput, UpdateCourseInput } from "../types/academic.types.js";

export async function getAllCourses(filters?: { department?: string; semester?: number; facultyId?: string }) {
  const where: { department?: string; semester?: number; facultyId?: string } = {};
  if (filters?.department) where.department = filters.department;
  if (filters?.semester) where.semester = filters.semester;
  if (filters?.facultyId) where.facultyId = filters.facultyId;

  return await prisma.course.findMany({
    where,
    include: {
      faculty: {
        select: {
          id: true,
          name: true,
          email: true,
          department: true,
        },
      },
      _count: {
        select: {
          enrollments: true,
          materials: true,
          assignments: true,
          quizzes: true,
        },
      },
    },
    orderBy: { code: "asc" },
  });
}

export async function getCourseById(courseId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      faculty: {
        select: {
          id: true,
          name: true,
          email: true,
          department: true,
          avatarUrl: true,
        },
      },
      materials: {
        orderBy: { createdAt: "asc" },
      },
      assignments: {
        orderBy: { dueDate: "asc" },
      },
      quizzes: {
        where: { published: true },
        include: {
          questions: {
            select: {
              id: true,
              question: true,
              options: true,
              topic: true,
              difficulty: true,
              bloomsLevel: true,
              orderIndex: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      _count: {
        select: {
          enrollments: true,
        },
      },
    },
  });

  if (!course) {
    throw Object.assign(new Error("Course not found"), { statusCode: 404 });
  }

  return course;
}

export async function createCourse(input: CreateCourseInput, facultyId: string) {
  const { code, title, description, department, semester, credits, totalModules } = input;

  if (!code || !title || !description) {
    throw Object.assign(new Error("Course code, title, and description are required"), { statusCode: 400 });
  }

  const existing = await prisma.course.findUnique({
    where: { code: code.trim().toUpperCase() },
  });

  if (existing) {
    throw Object.assign(new Error(`Course code '${code}' is already registered`), { statusCode: 409 });
  }

  return await prisma.course.create({
    data: {
      code: code.trim().toUpperCase(),
      title: title.trim(),
      description: description.trim(),
      department: department?.trim() || "Computer Engineering",
      semester: semester || 8,
      credits: credits || 4,
      totalModules: totalModules || 5,
      facultyId: input.facultyId || facultyId,
    },
    include: {
      faculty: {
        select: { id: true, name: true, email: true },
      },
    },
  });
}

export async function updateCourse(courseId: string, input: UpdateCourseInput, requestingUserId: string, role: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) {
    throw Object.assign(new Error("Course not found"), { statusCode: 404 });
  }

  // Authorization: Only course faculty owner or Admin can update
  if (role !== "ADMIN" && course.facultyId !== requestingUserId) {
    throw Object.assign(new Error("Forbidden: You do not have permission to modify this course"), { statusCode: 403 });
  }

  return await prisma.course.update({
    where: { id: courseId },
    data: {
      ...(input.title && { title: input.title.trim() }),
      ...(input.description && { description: input.description.trim() }),
      ...(input.department && { department: input.department.trim() }),
      ...(input.semester && { semester: input.semester }),
      ...(input.credits && { credits: input.credits }),
      ...(input.totalModules && { totalModules: input.totalModules }),
      ...(input.facultyId && { facultyId: input.facultyId }),
    },
  });
}

export async function deleteCourse(courseId: string, requestingUserId: string, role: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) {
    throw Object.assign(new Error("Course not found"), { statusCode: 404 });
  }

  if (role !== "ADMIN" && course.facultyId !== requestingUserId) {
    throw Object.assign(new Error("Forbidden: You do not have permission to delete this course"), { statusCode: 403 });
  }

  await prisma.course.delete({ where: { id: courseId } });
  return { message: "Course deleted successfully" };
}

export async function enrollStudentInCourse(studentId: string, courseId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) {
    throw Object.assign(new Error("Course not found"), { statusCode: 404 });
  }

  const existing = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId, courseId } },
  });

  if (existing) {
    throw Object.assign(new Error("Student is already enrolled in this course"), { statusCode: 409 });
  }

  return await prisma.enrollment.create({
    data: {
      studentId,
      courseId,
      status: "ACTIVE",
    },
    include: {
      course: true,
    },
  });
}

export async function unenrollStudentFromCourse(studentId: string, courseId: string) {
  const existing = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId, courseId } },
  });

  if (!existing) {
    throw Object.assign(new Error("Enrollment not found"), { statusCode: 404 });
  }

  await prisma.enrollment.delete({
    where: { id: existing.id },
  });

  return { message: "Student successfully unenrolled from course" };
}

export async function getCourseStudents(courseId: string) {
  const enrollments = await prisma.enrollment.findMany({
    where: { courseId },
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
    orderBy: { enrolledAt: "asc" },
  });

  return enrollments.map((e) => ({
    enrollmentId: e.id,
    enrolledAt: e.enrolledAt,
    progressPercentage: e.progressPercentage,
    status: e.status,
    ...e.student,
  }));
}
