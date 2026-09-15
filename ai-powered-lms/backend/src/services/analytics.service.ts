import prisma from "../lib/prisma.js";

export async function getStudentAnalytics(studentId: string) {
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { id: true, name: true, email: true, enrollmentNo: true, department: true },
  });

  if (!student) {
    throw Object.assign(new Error("Student not found"), { statusCode: 404 });
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { studentId },
    include: {
      course: { select: { id: true, code: true, title: true } },
    },
  });

  const attempts = await prisma.quizAttempt.findMany({
    where: { studentId },
    include: {
      quiz: { select: { title: true, topic: true, course: { select: { code: true } } } },
    },
  });

  const submissions = await prisma.submission.findMany({
    where: { studentId },
    include: {
      assignment: { select: { title: true, totalPoints: true, course: { select: { code: true } } } },
    },
  });

  const avgQuizScore =
    attempts.length > 0
      ? Math.round(attempts.reduce((acc, curr) => acc + curr.percentage, 0) / attempts.length)
      : 0;

  const avgProgress =
    enrollments.length > 0
      ? Math.round(enrollments.reduce((acc, curr) => acc + curr.progressPercentage, 0) / enrollments.length)
      : 0;

  return {
    student,
    summary: {
      enrolledCoursesCount: enrollments.length,
      averageCourseProgress: avgProgress,
      quizzesAttemptedCount: attempts.length,
      averageQuizScore: avgQuizScore,
      assignmentsSubmittedCount: submissions.length,
    },
    courseProgress: enrollments.map((e) => ({
      courseId: e.course.id,
      courseCode: e.course.code,
      courseTitle: e.course.title,
      progressPercentage: e.progressPercentage,
    })),
    recentAttempts: attempts.slice(0, 5),
  };
}

export async function getCourseAnalytics(courseId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      faculty: { select: { id: true, name: true, email: true } },
      enrollments: {
        include: {
          student: { select: { id: true, name: true, email: true, enrollmentNo: true } },
        },
      },
      quizzes: {
        include: {
          attempts: true,
        },
      },
      assignments: {
        include: {
          submissions: true,
        },
      },
    },
  });

  if (!course) {
    throw Object.assign(new Error("Course not found"), { statusCode: 404 });
  }

  const allAttempts = course.quizzes.flatMap((q) => q.attempts);
  const avgQuizScore =
    allAttempts.length > 0
      ? Math.round(allAttempts.reduce((acc, curr) => acc + curr.percentage, 0) / allAttempts.length)
      : 0;

  const avgProgress =
    course.enrollments.length > 0
      ? Math.round(
          course.enrollments.reduce((acc, curr) => acc + curr.progressPercentage, 0) /
            course.enrollments.length
        )
      : 0;

  return {
    course: {
      id: course.id,
      code: course.code,
      title: course.title,
      department: course.department,
      semester: course.semester,
      faculty: course.faculty,
    },
    metrics: {
      totalEnrolledStudents: course.enrollments.length,
      averageCourseProgress: avgProgress,
      totalQuizzes: course.quizzes.length,
      totalQuizAttempts: allAttempts.length,
      averageQuizScore: avgQuizScore,
      totalAssignments: course.assignments.length,
    },
    students: course.enrollments.map((e) => ({
      studentId: e.student.id,
      name: e.student.name,
      email: e.student.email,
      enrollmentNo: e.student.enrollmentNo,
      progressPercentage: e.progressPercentage,
    })),
  };
}

export async function getFacultyAnalytics(facultyId: string) {
  const faculty = await prisma.user.findUnique({
    where: { id: facultyId, role: "FACULTY" },
    include: {
      coursesTaught: {
        include: {
          enrollments: true,
          quizzes: { include: { attempts: true } },
          assignments: { include: { submissions: true } },
        },
      },
    },
  });

  if (!faculty) {
    throw Object.assign(new Error("Faculty not found"), { statusCode: 404 });
  }

  const totalCourses = faculty.coursesTaught.length;
  const totalStudents = faculty.coursesTaught.reduce((acc, c) => acc + c.enrollments.length, 0);
  const allAttempts = faculty.coursesTaught.flatMap((c) => c.quizzes.flatMap((q) => q.attempts));
  const avgQuizScore =
    allAttempts.length > 0
      ? Math.round(allAttempts.reduce((acc, curr) => acc + curr.percentage, 0) / allAttempts.length)
      : 0;

  const totalSubmissions = faculty.coursesTaught.reduce(
    (acc, c) => acc + c.assignments.reduce((sAcc, a) => sAcc + a.submissions.length, 0),
    0
  );

  return {
    faculty: {
      id: faculty.id,
      name: faculty.name,
      email: faculty.email,
      department: faculty.department,
      employeeId: faculty.employeeId,
    },
    overview: {
      totalCourses,
      totalStudentsEnrolled: totalStudents,
      averageStudentQuizPerformance: avgQuizScore,
      totalSubmissionsReceived: totalSubmissions,
    },
    courseBreakdown: faculty.coursesTaught.map((c) => ({
      id: c.id,
      code: c.code,
      title: c.title,
      enrolledCount: c.enrollments.length,
      quizzesCount: c.quizzes.length,
      assignmentsCount: c.assignments.length,
    })),
  };
}

export async function getAtRiskStudents() {
  const enrollments = await prisma.enrollment.findMany({
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          enrollmentNo: true,
          department: true,
        },
      },
      course: {
        select: {
          id: true,
          code: true,
          title: true,
        },
      },
    },
  });

  const atRiskList = [];

  for (const item of enrollments) {
    const attempts = await prisma.quizAttempt.findMany({
      where: {
        studentId: item.studentId,
        quiz: { courseId: item.courseId },
      },
    });

    const avgScore =
      attempts.length > 0
        ? Math.round(attempts.reduce((acc, curr) => acc + curr.percentage, 0) / attempts.length)
        : 0;

    let riskLevel: "HIGH" | "MEDIUM" | "LOW" | null = null;
    let reason = "";
    let intervention = "";

    if (item.progressPercentage < 40 && avgScore < 60) {
      riskLevel = "HIGH";
      reason = "Low course module progress (<40%) combined with failing quiz scores (<60%)";
      intervention = "Assign 1-on-1 peer tutor and schedule lab reinforcement session";
    } else if (item.progressPercentage < 50 || avgScore < 65) {
      riskLevel = "MEDIUM";
      reason = "Moderate diagnostic weakness on core syllabus topics";
      intervention = "Provide curated RAG-generated lecture review notes and diagnostic quiz";
    }

    if (riskLevel) {
      atRiskList.push({
        id: `risk-${item.studentId}-${item.courseId}`,
        studentId: item.student.id,
        studentName: item.student.name,
        studentEmail: item.student.email,
        enrollmentNo: item.student.enrollmentNo || "N/A",
        courseId: item.course.id,
        courseCode: item.course.code,
        courseTitle: item.course.title,
        riskLevel,
        primaryReason: reason,
        averageQuizScore: avgScore,
        courseProgressPercentage: item.progressPercentage,
        recommendedIntervention: intervention,
      });
    }
  }

  return atRiskList;
}
