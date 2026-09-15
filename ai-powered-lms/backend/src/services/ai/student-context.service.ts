import prisma from "../../lib/prisma.js";

export interface StudentEducationalProfile {
  isAvailable: boolean;
  academicLevel: string; // e.g. "Undergraduate Semester 8"
  enrolledProgress?: {
    courseCode: string;
    courseTitle: string;
    progressPercentage: number;
    status: string;
  };
  performanceSummary?: {
    averageQuizScore: number;
    quizzesAttemptedCount: number;
    assignmentsSubmittedCount: number;
    performanceBand: "Excellent" | "Proficient" | "Needs Reinforcement" | "New Student";
  };
  weakTopics: string[]; // e.g. ["Database Normalization", "B+ Tree Balancing"]
  materialProgress?: {
    lastMaterialTitle: string;
    unit: string;
    currentPage: number;
    totalPages: number;
    progressPercent: number;
  };
  activeRecommendations: Array<{
    title: string;
    topic: string;
    reason: string;
  }>;
  pedagogicalPromptSnippet: string;
}

export class StudentContextService {
  /**
   * Retrieves sanitized, educationally relevant student context for AI Tutor personalization.
   * STRICT PRIVACY MANDATE: Completely excludes personal identity markers (names, emails,
   * roll numbers, IDs, credentials) to protect student privacy.
   */
  public async getStudentEducationalProfile(
    studentId: string,
    courseId?: string
  ): Promise<StudentEducationalProfile> {
    try {
      // 1. Fetch enrollment in target course (if courseId provided)
      let enrollment = null;
      if (courseId) {
        enrollment = await prisma.enrollment.findUnique({
          where: {
            studentId_courseId: { studentId, courseId },
          },
          include: {
            course: { select: { code: true, title: true, semester: true } },
          },
        });
      }

      // 2. Fetch quiz attempts to extract weak topics and performance
      const quizAttempts = await prisma.quizAttempt.findMany({
        where: { studentId },
        include: {
          quiz: {
            select: {
              topic: true,
              courseId: true,
              course: { select: { code: true } },
            },
          },
        },
        orderBy: { completedAt: "desc" },
        take: 10,
      });

      // 3. Extract unique weak topics (prioritizing target course if specified)
      const targetCourseWeakTopics: string[] = [];
      const generalWeakTopics: string[] = [];

      for (const attempt of quizAttempts) {
        if (Array.isArray(attempt.weakTopicsIdentified)) {
          for (const topic of attempt.weakTopicsIdentified) {
            const cleanTopic = topic.trim();
            if (!cleanTopic) continue;

            if (courseId && attempt.quiz.courseId === courseId) {
              if (!targetCourseWeakTopics.includes(cleanTopic)) {
                targetCourseWeakTopics.push(cleanTopic);
              }
            } else {
              if (!generalWeakTopics.includes(cleanTopic)) {
                generalWeakTopics.push(cleanTopic);
              }
            }
          }
        }
      }

      const allWeakTopics = Array.from(new Set([...targetCourseWeakTopics, ...generalWeakTopics])).slice(0, 5);

      // 4. Calculate performance summary
      let performanceSummary: StudentEducationalProfile["performanceSummary"] | undefined;
      if (quizAttempts.length > 0) {
        const avgScore = Math.round(
          quizAttempts.reduce((acc, curr) => acc + curr.percentage, 0) / quizAttempts.length
        );

        let performanceBand: "Excellent" | "Proficient" | "Needs Reinforcement" | "New Student" = "Proficient";
        if (avgScore >= 80) performanceBand = "Excellent";
        else if (avgScore >= 60) performanceBand = "Proficient";
        else performanceBand = "Needs Reinforcement";

        const submissionCount = await prisma.submission.count({ where: { studentId } });

        performanceSummary = {
          averageQuizScore: avgScore,
          quizzesAttemptedCount: quizAttempts.length,
          assignmentsSubmittedCount: submissionCount,
          performanceBand,
        };
      }

      // 5. Fetch material reading progress
      let materialProgress: StudentEducationalProfile["materialProgress"] | undefined;
      if (courseId) {
        const latestMaterialProgress = await prisma.materialProgress.findFirst({
          where: {
            studentId,
            material: { courseId },
          },
          include: {
            material: { select: { title: true, unit: true } },
          },
          orderBy: { lastOpenedAt: "desc" },
        });

        if (latestMaterialProgress) {
          materialProgress = {
            lastMaterialTitle: latestMaterialProgress.material.title,
            unit: latestMaterialProgress.material.unit,
            currentPage: latestMaterialProgress.currentPage,
            totalPages: latestMaterialProgress.totalPages,
            progressPercent: Math.round(latestMaterialProgress.progressPercent),
          };
        }
      }

      // 6. Fetch active recommendations
      const recommendations = await prisma.recommendation.findMany({
        where: {
          studentId,
          status: "ACTIVE",
          ...(courseId ? { courseId } : {}),
        },
        select: { title: true, topic: true, reason: true },
        take: 3,
      });

      // 7. Format sanitized pedagogical prompt snippet
      const pedagogicalPromptSnippet = this.buildPedagogicalPromptSnippet({
        enrollment,
        performanceSummary,
        weakTopics: allWeakTopics,
        materialProgress,
        recommendations,
      });

      return {
        isAvailable: true,
        academicLevel: enrollment?.course?.semester
          ? `Undergraduate Semester ${enrollment.course.semester}`
          : "Undergraduate Computer Engineering",
        enrolledProgress: enrollment
          ? {
              courseCode: enrollment.course.code,
              courseTitle: enrollment.course.title,
              progressPercentage: Math.round(enrollment.progressPercentage),
              status: enrollment.status,
            }
          : undefined,
        performanceSummary,
        weakTopics: allWeakTopics,
        materialProgress,
        activeRecommendations: recommendations,
        pedagogicalPromptSnippet,
      };
    } catch (err) {
      console.warn("[STUDENT CONTEXT WARNING] Failed to load student educational profile, using neutral fallback:", err);
      return this.getFallbackProfile();
    }
  }

  /**
   * Neutral fallback educational profile when no prior records exist or when database queries fail.
   */
  public getFallbackProfile(): StudentEducationalProfile {
    return {
      isAvailable: false,
      academicLevel: "Undergraduate Computer Engineering",
      weakTopics: [],
      activeRecommendations: [],
      pedagogicalPromptSnippet:
        "STUDENT EDUCATIONAL PROFILE:\n- Academic Level: Undergraduate Computer Engineering\n- Assessment History: No prior assessment or diagnostic records available.\n- Pedagogical Directive: Provide clear, authoritative, first-principles explanations suitable for an undergraduate student.",
    };
  }

  private buildPedagogicalPromptSnippet(data: {
    enrollment: any;
    performanceSummary?: StudentEducationalProfile["performanceSummary"];
    weakTopics: string[];
    materialProgress?: StudentEducationalProfile["materialProgress"];
    recommendations: Array<{ title: string; topic: string; reason: string }>;
  }): string {
    const lines: string[] = ["STUDENT EDUCATIONAL PROFILE (STRICTLY PRIVACY-PRESERVED):"];

    if (data.enrollment) {
      lines.push(
        `- Enrolled Course: ${data.enrollment.course.code} (${data.enrollment.course.title})`
      );
      lines.push(`- Course Progress: ${Math.round(data.enrollment.progressPercentage)}% completed`);
    }

    if (data.performanceSummary) {
      lines.push(
        `- Academic Performance Band: ${data.performanceSummary.performanceBand} (Average Diagnostic Score: ${data.performanceSummary.averageQuizScore}%)`
      );
    } else {
      lines.push("- Assessment History: New learner; no diagnostic quiz records yet.");
    }

    if (data.weakTopics.length > 0) {
      lines.push(
        `- Identified Weak Topics: ${data.weakTopics.join(", ")}`
      );
      lines.push(
        `  * Pedagogical Directive: If the student's question relates to any of these weak topics (e.g. ${data.weakTopics[0]}), adapt your explanation to emphasize foundational mechanics, contrast common misconceptions, and use concrete, illustrative code or architecture examples.`
      );
    } else {
      lines.push("- Identified Weak Topics: None identified yet.");
    }

    if (data.materialProgress) {
      lines.push(
        `- Active Reading: "${data.materialProgress.lastMaterialTitle}" (${data.materialProgress.unit}), Page ${data.materialProgress.currentPage}/${data.materialProgress.totalPages} (${data.materialProgress.progressPercent}% read)`
      );
    }

    if (data.recommendations.length > 0) {
      lines.push(
        `- Recommended Focus Areas: ${data.recommendations.map((r) => `"${r.topic}": ${r.reason}`).join("; ")}`
      );
    }

    return lines.join("\n");
  }
}

export const studentContextService = new StudentContextService();
