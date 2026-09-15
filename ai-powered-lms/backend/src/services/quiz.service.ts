import prisma from "../lib/prisma.js";
import {
  CreateQuizInput,
  CreateQuizQuestionInput,
  SubmitQuizAttemptInput,
} from "../types/academic.types.js";

export async function getQuizzesByCourse(courseId: string, role: string) {
  const where: { courseId: string; published?: boolean } = { courseId };
  if (role === "STUDENT") {
    where.published = true;
  }

  return await prisma.quiz.findMany({
    where,
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
          ...(role !== "STUDENT" && { correctOptionIndex: true, explanation: true }),
        },
        orderBy: { orderIndex: "asc" },
      },
      _count: {
        select: {
          attempts: true,
          questions: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getQuizById(quizId: string, role: string) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      course: {
        select: {
          id: true,
          code: true,
          title: true,
          facultyId: true,
        },
      },
      questions: {
        select: {
          id: true,
          question: true,
          options: true,
          topic: true,
          difficulty: true,
          bloomsLevel: true,
          orderIndex: true,
          ...(role !== "STUDENT" && { correctOptionIndex: true, explanation: true }),
        },
        orderBy: { orderIndex: "asc" },
      },
      _count: {
        select: {
          attempts: true,
        },
      },
    },
  });

  if (!quiz) {
    throw Object.assign(new Error("Quiz not found"), { statusCode: 404 });
  }

  return quiz;
}

export async function createQuiz(
  courseId: string,
  input: CreateQuizInput,
  facultyId: string,
  role: string
) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) {
    throw Object.assign(new Error("Course not found"), { statusCode: 404 });
  }

  if (role !== "ADMIN" && course.facultyId !== facultyId) {
    throw Object.assign(new Error("Forbidden: You can only create quizzes for your own courses"), { statusCode: 403 });
  }

  const { title, topic, difficulty, timeLimitMinutes, questions } = input;
  if (!title || !topic) {
    throw Object.assign(new Error("Quiz title and topic are required"), { statusCode: 400 });
  }

  const createdQuiz = await prisma.quiz.create({
    data: {
      courseId,
      title: title.trim(),
      topic: topic.trim(),
      difficulty: difficulty || "Medium",
      timeLimitMinutes: timeLimitMinutes || 20,
      totalQuestions: questions?.length || 0,
      published: true,
      questions: questions
        ? {
            create: questions.map((q, idx) => ({
              question: q.question.trim(),
              options: q.options,
              correctOptionIndex: q.correctOptionIndex,
              explanation: q.explanation?.trim() || "",
              topic: q.topic?.trim() || topic.trim(),
              difficulty: q.difficulty || difficulty || "Medium",
              bloomsLevel: q.bloomsLevel || "Understand",
              orderIndex: idx + 1,
            })),
          }
        : undefined,
    },
    include: {
      questions: true,
    },
  });

  return createdQuiz;
}

export async function updateQuiz(
  quizId: string,
  input: Partial<CreateQuizInput>,
  userId: string,
  role: string
) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: { course: true },
  });

  if (!quiz) {
    throw Object.assign(new Error("Quiz not found"), { statusCode: 404 });
  }

  if (role !== "ADMIN" && quiz.course.facultyId !== userId) {
    throw Object.assign(new Error("Forbidden: You can only edit quizzes for your own courses"), { statusCode: 403 });
  }

  return await prisma.quiz.update({
    where: { id: quizId },
    data: {
      ...(input.title && { title: input.title.trim() }),
      ...(input.topic && { topic: input.topic.trim() }),
      ...(input.difficulty && { difficulty: input.difficulty }),
      ...(input.timeLimitMinutes && { timeLimitMinutes: input.timeLimitMinutes }),
    },
  });
}

export async function deleteQuiz(quizId: string, userId: string, role: string) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: { course: true },
  });

  if (!quiz) {
    throw Object.assign(new Error("Quiz not found"), { statusCode: 404 });
  }

  if (role !== "ADMIN" && quiz.course.facultyId !== userId) {
    throw Object.assign(new Error("Forbidden: You can only delete quizzes for your own courses"), { statusCode: 403 });
  }

  await prisma.quiz.delete({ where: { id: quizId } });
  return { message: "Quiz deleted successfully" };
}

export async function publishQuiz(quizId: string, userId: string, role: string) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: { course: true },
  });

  if (!quiz) {
    throw Object.assign(new Error("Quiz not found"), { statusCode: 404 });
  }

  if (role !== "ADMIN" && quiz.course.facultyId !== userId) {
    throw Object.assign(new Error("Forbidden: You can only publish quizzes for your own courses"), { statusCode: 403 });
  }

  return await prisma.quiz.update({
    where: { id: quizId },
    data: { published: true },
  });
}

export async function addQuestionToQuiz(
  quizId: string,
  input: CreateQuizQuestionInput,
  userId: string,
  role: string
) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: { course: true },
  });

  if (!quiz) {
    throw Object.assign(new Error("Quiz not found"), { statusCode: 404 });
  }

  if (role !== "ADMIN" && quiz.course.facultyId !== userId) {
    throw Object.assign(new Error("Forbidden: You can only add questions for your own courses"), { statusCode: 403 });
  }

  const { question, options, correctOptionIndex, explanation, topic, difficulty, bloomsLevel } = input;
  if (!question || !options || options.length < 2 || correctOptionIndex === undefined) {
    throw Object.assign(new Error("Question text, at least 2 options, and a valid correct option index are required"), { statusCode: 400 });
  }

  const newQuestion = await prisma.question.create({
    data: {
      quizId,
      question: question.trim(),
      options,
      correctOptionIndex,
      explanation: explanation?.trim() || "",
      topic: topic?.trim() || quiz.topic,
      difficulty: difficulty || quiz.difficulty,
      bloomsLevel: bloomsLevel || "Understand",
      orderIndex: (await prisma.question.count({ where: { quizId } })) + 1,
    },
  });

  await prisma.quiz.update({
    where: { id: quizId },
    data: { totalQuestions: { increment: 1 } },
  });

  return newQuestion;
}

export async function submitQuizAttempt(
  quizId: string,
  studentId: string,
  input: SubmitQuizAttemptInput
) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      course: true,
      questions: true,
    },
  });

  if (!quiz) {
    throw Object.assign(new Error("Quiz not found"), { statusCode: 404 });
  }

  const totalQuestions = quiz.questions.length;
  if (totalQuestions === 0) {
    throw Object.assign(new Error("Cannot attempt an empty quiz"), { statusCode: 400 });
  }

  const questionMap = new Map(quiz.questions.map((q) => [q.id, q]));
  let correctCount = 0;
  const weakTopics: Set<string> = new Set();
  const answersData: {
    questionId: string;
    selectedOptionIndex: number;
    isCorrect: boolean;
  }[] = [];

  for (const item of input.answers) {
    const question = questionMap.get(item.questionId);
    if (!question) continue;

    const isCorrect = question.correctOptionIndex === item.selectedOptionIndex;
    if (isCorrect) {
      correctCount++;
    } else {
      if (question.topic) {
        weakTopics.add(question.topic);
      }
    }

    answersData.push({
      questionId: item.questionId,
      selectedOptionIndex: item.selectedOptionIndex,
      isCorrect,
    });
  }

  const pointsPerQuestion = 10;
  const totalPoints = totalQuestions * pointsPerQuestion;
  const score = correctCount * pointsPerQuestion;
  const percentage = Math.round((score / totalPoints) * 100);

  const attempt = await prisma.quizAttempt.create({
    data: {
      quizId,
      studentId,
      score,
      totalPoints,
      percentage,
      timeSpentSeconds: input.timeSpentSeconds || 0,
      weakTopicsIdentified: Array.from(weakTopics),
      answers: {
        create: answersData,
      },
    },
    include: {
      answers: true,
      quiz: {
        select: {
          id: true,
          title: true,
          topic: true,
          course: {
            select: { id: true, code: true, title: true },
          },
        },
      },
    },
  });

  // Update student performance for course
  await prisma.performance.upsert({
    where: { studentId_courseId: { studentId, courseId: quiz.courseId } },
    update: {
      quizzesAttempted: { increment: 1 },
      lastCalculatedAt: new Date(),
    },
    create: {
      studentId,
      courseId: quiz.courseId,
      averageScore: percentage,
      quizzesAttempted: 1,
      assignmentsSubmitted: 0,
    },
  });

  return attempt;
}

export async function getAttemptById(attemptId: string, userId: string, role: string) {
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      quiz: {
        include: {
          course: true,
          questions: true,
        },
      },
      answers: true,
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

  if (!attempt) {
    throw Object.assign(new Error("Quiz attempt not found"), { statusCode: 404 });
  }

  if (role === "STUDENT" && attempt.studentId !== userId) {
    throw Object.assign(new Error("Forbidden: Access denied to this attempt"), { statusCode: 403 });
  }

  return attempt;
}

export async function getStudentQuizAttempts(studentId: string) {
  return await prisma.quizAttempt.findMany({
    where: { studentId },
    include: {
      quiz: {
        select: {
          id: true,
          title: true,
          topic: true,
          course: {
            select: { id: true, code: true, title: true },
          },
        },
      },
    },
    orderBy: { completedAt: "desc" },
  });
}
