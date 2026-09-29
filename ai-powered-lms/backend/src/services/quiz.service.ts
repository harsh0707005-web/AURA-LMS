import prisma from "../lib/prisma.js";
import {
  CreateQuizInput,
  CreateQuizQuestionInput,
  SubmitQuizAttemptInput,
} from "../types/academic.types.js";
import { quizPublicationIdempotency } from "../lib/idempotency.js";


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

/**
 * Creates and publishes a new quiz for a course with DATABASE-ENFORCED idempotency.
 *
 * When a non-null `idempotencyKey` is supplied the guarantee is:
 *   1. Lookup: If a Quiz with that key already exists for the same course and faculty,
 *      return it immediately without creating a duplicate.
 *   2. Insert: Attempt to INSERT the new quiz row with the key stored in the DB column.
 *   3. Race-catch: On a Prisma `P2002` unique-constraint violation (concurrent insert won),
 *      perform a final `findUnique` by the key and return the winning row.
 *
 * The in-memory `IdempotencyManager` is used **only** as a best-effort optimisation to
 * short-circuit concurrent in-process requests before they reach the DB layer.  It is
 * NOT the correctness guarantee — the DB UNIQUE constraint is.
 *
 * @param courseId Unique ID of the course.
 * @param input Quiz metadata and questions payload.
 * @param facultyId Requesting faculty user ID.
 * @param role Requesting user role ("FACULTY" | "ADMIN").
 * @returns The newly created or idempotently resolved Quiz record.
 */
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

  // ALL AI-generated publishes require explicit fallbackAcknowledged confirmation.
  // We do not trust client-provided sourceCitation as proof of grounding.
  if (input.isAiGenerated && questions && questions.length > 0) {
    if (!input.fallbackAcknowledged) {
      throw Object.assign(
        new Error("Forbidden: Cannot publish an AI-generated quiz without explicit fallbackAcknowledged confirmation"),
        { statusCode: 400 }
      );
    }
  }

  const idempotencyKey = input.idempotencyKey?.trim() || null;

  /**
   * Builds the Prisma create data payload shared by both the direct path and
   * the idempotent path.
   */
  const buildCreateData = () => ({
    courseId,
    title: title.trim(),
    topic: topic.trim(),
    difficulty: difficulty || "Medium",
    timeLimitMinutes: timeLimitMinutes || 20,
    totalQuestions: questions?.length || 0,
    isAiGenerated: Boolean(input.isAiGenerated),
    published: true,
    ...(idempotencyKey ? { idempotencyKey } : {}),
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
  });

  const includeClause = { questions: true } as const;

  // ── Fast path: no idempotency key – just create directly ─────────────────
  if (!idempotencyKey) {
    return await prisma.quiz.create({
      data: buildCreateData(),
      include: includeClause,
    });
  }

  // ── Idempotent path ───────────────────────────────────────────────────────
  // Step 1: Check DB for an existing quiz with this key (cross-process safety)
  const existing = await prisma.quiz.findUnique({
    where: { idempotencyKey },
    include: includeClause,
  });
  if (existing) {
    // Verify this key belongs to the same course to prevent cross-course key reuse.
    if (existing.courseId !== courseId) {
      throw Object.assign(
        new Error("Idempotency key collision: key is already bound to a different course"),
        { statusCode: 409 }
      );
    }
    return existing;
  }

  // Step 2: Use in-memory deduplication as an optimisation for concurrent in-process requests
  const { data: quiz } = await quizPublicationIdempotency.execute(
    idempotencyKey,
    async () => {
      try {
        // Step 3: Attempt DB insert with the idempotency key
        return await prisma.quiz.create({
          data: buildCreateData(),
          include: includeClause,
        });
      } catch (err: any) {
        // Step 4: On unique constraint violation (race condition), return the winner row
        if (err?.code === "P2002") {
          const winner = await prisma.quiz.findUnique({
            where: { idempotencyKey },
            include: includeClause,
          });
          if (winner) {
            // Apply the same course-scope protection on the winner row
            if (winner.courseId !== courseId) {
              throw Object.assign(
                new Error("Idempotency key collision: key is already bound to a different course"),
                { statusCode: 409 }
              );
            }
            return winner;
          }
        }
        throw err;
      }
    }
  );

  return quiz;
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
