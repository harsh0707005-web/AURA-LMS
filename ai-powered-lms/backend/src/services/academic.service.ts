import prisma from "../lib/prisma.js";
import { sanitizeUser } from "./auth.service.js";

// Student Services
export async function getAllStudents() {
  const students = await prisma.user.findMany({
    where: { role: "STUDENT" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      enrollmentNo: true,
      avatarUrl: true,
      createdAt: true,
      _count: {
        select: {
          enrollments: true,
          quizAttempts: true,
          submissions: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return students;
}

export async function getStudentById(studentId: string) {
  const student = await prisma.user.findUnique({
    where: { id: studentId, role: "STUDENT" },
    include: {
      enrollments: {
        include: {
          course: {
            include: {
              faculty: {
                select: { id: true, name: true, email: true },
              },
            },
          },
        },
      },
      performances: true,
      recommendations: {
        where: { status: "ACTIVE" },
      },
    },
  });

  if (!student) {
    throw Object.assign(new Error("Student not found"), { statusCode: 404 });
  }

  return sanitizeUser(student as any);
}

export async function getStudentCourses(studentId: string) {
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId },
    include: {
      course: {
        include: {
          faculty: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: {
              materials: true,
              assignments: true,
              quizzes: true,
              enrollments: true,
            },
          },
        },
      },
    },
    orderBy: { enrolledAt: "desc" },
  });

  return enrollments.map((e) => ({
    enrollmentId: e.id,
    progressPercentage: e.progressPercentage,
    status: e.status,
    enrolledAt: e.enrolledAt,
    ...e.course,
  }));
}

export async function getStudentPerformance(studentId: string) {
  const performances = await prisma.performance.findMany({
    where: { studentId },
    include: {
      course: {
        select: { id: true, code: true, title: true },
      },
    },
  });

  const attempts = await prisma.quizAttempt.findMany({
    where: { studentId },
    include: {
      quiz: {
        select: { title: true, topic: true, course: { select: { code: true } } },
      },
    },
    orderBy: { completedAt: "desc" },
  });

  const submissions = await prisma.submission.findMany({
    where: { studentId },
    include: {
      assignment: {
        select: { title: true, totalPoints: true, course: { select: { code: true } } },
      },
    },
    orderBy: { submittedAt: "desc" },
  });

  const totalQuizzes = attempts.length;
  const avgQuizScore =
    totalQuizzes > 0
      ? Math.round(attempts.reduce((acc, curr) => acc + curr.percentage, 0) / totalQuizzes)
      : 0;

  return {
    performances,
    recentAttempts: attempts.slice(0, 5),
    recentSubmissions: submissions.slice(0, 5),
    stats: {
      totalQuizzesAttempted: totalQuizzes,
      averageQuizScore: avgQuizScore,
      assignmentsSubmittedCount: submissions.length,
    },
  };
}

export async function getStudentRecommendations(studentId: string) {
  return await prisma.recommendation.findMany({
    where: { studentId, status: "ACTIVE" },
    include: {
      course: {
        select: { id: true, code: true, title: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getStudentWeakTopics(studentId: string) {
  const attempts = await prisma.quizAttempt.findMany({
    where: { studentId },
    select: {
      weakTopicsIdentified: true,
      quiz: {
        select: {
          topic: true,
          course: {
            select: { id: true, code: true, title: true },
          },
        },
      },
    },
  });

  const topicCountMap = new Map<string, { topic: string; courseCode: string; courseId: string; count: number }>();

  for (const attempt of attempts) {
    for (const weak of attempt.weakTopicsIdentified) {
      const key = `${attempt.quiz.course.code}-${weak}`;
      if (!topicCountMap.has(key)) {
        topicCountMap.set(key, {
          topic: weak,
          courseCode: attempt.quiz.course.code,
          courseId: attempt.quiz.course.id,
          count: 1,
        });
      } else {
        const item = topicCountMap.get(key)!;
        item.count++;
      }
    }
  }

  return Array.from(topicCountMap.values()).map((t, idx) => ({
    id: `wt-${idx + 1}`,
    topic: t.topic,
    courseCode: t.courseCode,
    courseId: t.courseId,
    severity: t.count > 1 ? "CRITICAL" : "MODERATE",
    recommendedAction: `Review lecture notes and attempt diagnostic practice for ${t.topic}`,
  }));
}

// Faculty Services
export async function getAllFaculty() {
  return await prisma.user.findMany({
    where: { role: "FACULTY" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      employeeId: true,
      avatarUrl: true,
      createdAt: true,
      _count: {
        select: {
          coursesTaught: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function getFacultyById(facultyId: string) {
  const faculty = await prisma.user.findUnique({
    where: { id: facultyId, role: "FACULTY" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      employeeId: true,
      avatarUrl: true,
      createdAt: true,
      coursesTaught: {
        include: {
          _count: {
            select: {
              enrollments: true,
              assignments: true,
              quizzes: true,
              materials: true,
            },
          },
        },
      },
    },
  });

  if (!faculty) {
    throw Object.assign(new Error("Faculty not found"), { statusCode: 404 });
  }

  return faculty;
}

export async function getFacultyCourses(facultyId: string) {
  return await prisma.course.findMany({
    where: { facultyId },
    include: {
      _count: {
        select: {
          enrollments: true,
          assignments: true,
          quizzes: true,
          materials: true,
        },
      },
    },
    orderBy: { code: "asc" },
  });
}
