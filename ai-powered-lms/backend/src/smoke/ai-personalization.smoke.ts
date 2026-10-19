import assert from "node:assert/strict";
import test from "node:test";
import prisma from "../lib/prisma.js";
import { studentContextService } from "../services/ai/student-context.service.js";

test("course-bound personalization scopes assessment and assignment data to the selected course", async (t) => {
  const calls: Record<string, any> = {};
  const originals = {
    enrollment: prisma.enrollment.findUnique,
    attempts: prisma.quizAttempt.findMany,
    submissions: prisma.submission.count,
    progress: prisma.materialProgress.findFirst,
    recommendations: prisma.recommendation.findMany,
  };

  prisma.enrollment.findUnique = (async (args: any) => {
    calls.enrollment = args;
    return {
      progressPercentage: 42,
      status: "ACTIVE",
      course: { code: "CS-A", title: "Course A", semester: 8 },
    };
  }) as any;
  prisma.quizAttempt.findMany = (async (args: any) => {
    calls.attempts = args;
    return [{ percentage: 40, weakTopicsIdentified: ["Topic A"], quiz: { courseId: "course-a", topic: "Topic A", course: { code: "CS-A" } } }];
  }) as any;
  prisma.submission.count = (async (args: any) => {
    calls.submissions = args;
    return 2;
  }) as any;
  prisma.materialProgress.findFirst = (async (args: any) => {
    calls.progress = args;
    return null;
  }) as any;
  prisma.recommendation.findMany = (async (args: any) => {
    calls.recommendations = args;
    return [];
  }) as any;

  t.after(() => {
    prisma.enrollment.findUnique = originals.enrollment;
    prisma.quizAttempt.findMany = originals.attempts;
    prisma.submission.count = originals.submissions;
    prisma.materialProgress.findFirst = originals.progress;
    prisma.recommendation.findMany = originals.recommendations;
  });

  const profile = await studentContextService.getStudentEducationalProfile("student-1", "course-a");

  assert.deepEqual(calls.attempts.where, { studentId: "student-1", quiz: { courseId: "course-a" } });
  assert.deepEqual(calls.submissions.where, { studentId: "student-1", assignment: { courseId: "course-a" } });
  assert.deepEqual(profile.weakTopics, ["Topic A"]);
  assert.match(profile.pedagogicalPromptSnippet, /Academic Level: Undergraduate Semester 8/);
  assert.match(profile.pedagogicalPromptSnippet, /Course Progress: 42%/);
});

test("missing personalization records return a neutral profile instead of failing the tutor request", async (t) => {
  const original = studentContextService.getStudentEducationalProfile;
  studentContextService.getStudentEducationalProfile = (async () => studentContextService.getFallbackProfile()) as any;
  t.after(() => {
    studentContextService.getStudentEducationalProfile = original;
  });

  const profile = await studentContextService.getStudentEducationalProfile("student-without-history", "course-a");
  assert.equal(profile.isAvailable, false);
  assert.deepEqual(profile.weakTopics, []);
  assert.match(profile.pedagogicalPromptSnippet, /No prior assessment/);
});
