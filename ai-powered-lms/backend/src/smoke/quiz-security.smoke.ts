import assert from "node:assert/strict";
import test from "node:test";
import prisma from "../lib/prisma.js";
import { submitQuizAttempt, getQuizById, getQuizzesByCourse } from "../services/quiz.service.js";

const quiz = {
  id: "quiz-1",
  courseId: "course-1",
  published: true,
  questions: [{ id: "question-1", options: ["A", "B"], correctOptionIndex: 0, topic: null }],
};
const validInput = { timeSpentSeconds: 10, answers: [{ questionId: "question-1", selectedOptionIndex: 0 }] };

const replace = (target: any, method: string, implementation: (...args: any[]) => any, afterHook: (fn: () => void) => void) => {
  const original = target[method];
  target[method] = implementation;
  afterHook(() => {
    target[method] = original;
  });
  return {
    mockImplementation(newImpl: (...args: any[]) => any) {
      target[method] = newImpl;
    },
  };
};

test("quiz submission enforces current student role, enrollment, publication, and answer shape", async (t) => {
  replace(prisma.user, "findUnique", async () => ({ role: "STUDENT" }) as any, t.after.bind(t));
  const quizLookup = replace(prisma.quiz, "findUnique", async () => quiz as any, t.after.bind(t));
  const enrollment = replace(prisma.enrollment, "findUnique", async () => ({ status: "ACTIVE" }) as any, t.after.bind(t));
  replace(prisma.quizAttempt, "create", async ({ data }: any) => data, t.after.bind(t));
  replace(prisma.performance, "upsert", async () => ({} as any), t.after.bind(t));

  const submit = (input: any, callerRole = "STUDENT") =>
    submitQuizAttempt("quiz-1", "student-1", callerRole, input);

  await assert.rejects(submit(validInput, "FACULTY"), { statusCode: 403 });
  await assert.rejects(submit(validInput, "ADMIN"), { statusCode: 403 });

  enrollment.mockImplementation(async () => null);
  await assert.rejects(submit(validInput), { statusCode: 403 });

  enrollment.mockImplementation(async () => ({ status: "ACTIVE" }) as any);
  quizLookup.mockImplementation(async () => ({ ...quiz, published: false }) as any);
  await assert.rejects(submit(validInput), { statusCode: 403 });

  quizLookup.mockImplementation(async () => quiz as any);
  for (const input of [
    null,
    {},
    { answers: null },
    { answers: [{}] },
    { answers: [{ questionId: "not-in-quiz", selectedOptionIndex: 0 }] },
    { answers: [{ questionId: "question-1", selectedOptionIndex: -1 }] },
    { answers: [{ questionId: "question-1", selectedOptionIndex: 2 }] },
    { answers: [{ questionId: "question-1", selectedOptionIndex: 0 }, { questionId: "question-1", selectedOptionIndex: 0 }] },
  ]) {
    await assert.rejects(submit(input), { statusCode: 400 });
  }

  const result = await submit(validInput);
  assert.equal(result.score, 10);
  assert.equal(result.totalPoints, 10);
  assert.equal(result.percentage, 100);
});

test("service does not trust a caller role that differs from the database", async (t) => {
  replace(prisma.user, "findUnique", async () => ({ role: "FACULTY" }) as any, t.after.bind(t));
  await assert.rejects(submitQuizAttempt("quiz-1", "faculty-1", "STUDENT", validInput), { statusCode: 403 });
});

test("student quiz retrieval enforces publication and active enrollment", async (t) => {
  const quizLookup = replace(prisma.quiz, "findUnique", async () => quiz as any, t.after.bind(t));
  const enrollment = replace(prisma.enrollment, "findUnique", async () => ({ status: "ACTIVE" }) as any, t.after.bind(t));
  const courseLookup = replace(prisma.course, "findUnique", async () => ({ id: "course-1" }) as any, t.after.bind(t));
  replace(prisma.quiz, "findMany", async () => [quiz] as any, t.after.bind(t));

  // Unpublished quiz is hidden from students (404)
  quizLookup.mockImplementation(async () => ({ ...quiz, published: false }) as any);
  await assert.rejects(getQuizById("quiz-1", "student-1", "STUDENT"), { statusCode: 404 });

  // Non-enrolled student cannot access quiz (403)
  quizLookup.mockImplementation(async () => quiz as any);
  enrollment.mockImplementation(async () => null);
  await assert.rejects(getQuizById("quiz-1", "student-1", "STUDENT"), { statusCode: 403 });

  // Non-enrolled student cannot list course quizzes (403)
  await assert.rejects(getQuizzesByCourse("course-1", "student-1", "STUDENT"), { statusCode: 403 });

  // Missing course returns 404
  courseLookup.mockImplementation(async () => null);
  await assert.rejects(getQuizzesByCourse("missing-course", "student-1", "STUDENT"), { statusCode: 404 });

  // Enrolled student can retrieve published quiz
  courseLookup.mockImplementation(async () => ({ id: "course-1" }) as any);
  enrollment.mockImplementation(async () => ({ status: "ACTIVE" }) as any);
  const studentQuiz = await getQuizById("quiz-1", "student-1", "STUDENT");
  assert.equal(studentQuiz.id, "quiz-1");

  const list = await getQuizzesByCourse("course-1", "student-1", "STUDENT");
  assert.equal(list.length, 1);
});
