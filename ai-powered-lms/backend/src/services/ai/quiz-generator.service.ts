import prisma from "../../lib/prisma.js";
import {
  GenerateQuizInput,
  GenerateQuizResponseData,
  GeneratedQuestion,
  Difficulty,
  BloomsLevel,
} from "../../types/academic.types.js";
import { ragService } from "./rag.service.js";
import { getLLMProvider } from "./providers/provider.registry.js";

/**
 * Strict OpenAPI / Gemini Schema definition for structured JSON quiz generation.
 */
export const QuizResponseSchema = {
  type: "OBJECT",
  properties: {
    quizTitle: {
      type: "STRING",
      description: "A concise, academic assessment title based on the syllabus topic",
    },
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          question: {
            type: "STRING",
            description: "Clear, unambiguous question text testing academic understanding or application",
          },
          options: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "An array of exactly 4 distinct multiple choice answer options",
          },
          correctOptionIndex: {
            type: "INTEGER",
            description: "0-based index of the correct option (0, 1, 2, or 3)",
          },
          explanation: {
            type: "STRING",
            description: "Detailed pedagogical explanation of why the correct option is right and distractors are wrong",
          },
          bloomsLevel: {
            type: "STRING",
            enum: ["Remember", "Understand", "Apply", "Analyze", "Evaluate"],
            description: "Bloom's taxonomy cognitive level",
          },
          difficulty: {
            type: "STRING",
            enum: ["Easy", "Medium", "Hard"],
            description: "Difficulty classification",
          },
          topic: {
            type: "STRING",
            description: "Sub-topic or concept tested by this question",
          },
          sourceCitation: {
            type: "STRING",
            description: "Document name, unit, and page reference from syllabus context (e.g., 'Distributed_Systems_Lec4.pdf (Unit 2, Page 14)') or empty string if general curriculum fallback",
          },
        },
        required: [
          "question",
          "options",
          "correctOptionIndex",
          "explanation",
          "bloomsLevel",
          "difficulty",
          "topic",
        ],
      },
    },
  },
  required: ["quizTitle", "questions"],
};

/**
 * Mandatory Server-Side Validation Layer.
 * Validates generated questions independent of LLM output guarantees.
 * Any validation failure rejects the generation and prevents any database persistence.
 */
export function validateGeneratedQuestions(
  questions: any[],
  isGrounded: boolean
): GeneratedQuestion[] {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw Object.assign(
      new Error("Validation failed: generated questions array must contain at least 1 question"),
      { statusCode: 422 }
    );
  }

  const validBlooms: BloomsLevel[] = [
    "Remember",
    "Understand",
    "Apply",
    "Analyze",
    "Evaluate",
  ];
  const validDifficulty: Difficulty[] = ["Easy", "Medium", "Hard"];

  const validated: GeneratedQuestion[] = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const prefix = `Question ${i + 1} validation failed:`;

    if (!q || typeof q !== "object") {
      throw Object.assign(new Error(`${prefix} question must be a valid JSON object`), {
        statusCode: 422,
      });
    }

    // 1. Question text non-empty
    if (typeof q.question !== "string" || !q.question.trim()) {
      throw Object.assign(new Error(`${prefix} question text must be a non-empty string`), {
        statusCode: 422,
      });
    }

    // 2. Exactly 4 options
    if (!Array.isArray(q.options) || q.options.length !== 4) {
      throw Object.assign(
        new Error(`${prefix} must provide exactly 4 options (received ${Array.isArray(q.options) ? q.options.length : "invalid"})`),
        { statusCode: 422 }
      );
    }

    // 3. All 4 options non-empty and mutually distinct
    const trimmedOptions = q.options.map((opt: any, optIdx: number) => {
      if (typeof opt !== "string" || !opt.trim()) {
        throw Object.assign(
          new Error(`${prefix} option ${optIdx + 1} must be a non-empty string`),
          { statusCode: 422 }
        );
      }
      return opt.trim();
    });

    const uniqueOptions = new Set(trimmedOptions.map((o: string) => o.toLowerCase()));
    if (uniqueOptions.size !== 4) {
      throw Object.assign(
        new Error(`${prefix} all 4 options must be distinct (duplicate choices found)`),
        { statusCode: 422 }
      );
    }

    // 4. Correct option index in range 0..3
    if (
      typeof q.correctOptionIndex !== "number" ||
      !Number.isInteger(q.correctOptionIndex) ||
      q.correctOptionIndex < 0 ||
      q.correctOptionIndex > 3
    ) {
      throw Object.assign(
        new Error(`${prefix} correctOptionIndex must be an integer between 0 and 3`),
        { statusCode: 422 }
      );
    }

    // 5. Blooms taxonomy level
    if (!validBlooms.includes(q.bloomsLevel)) {
      throw Object.assign(
        new Error(`${prefix} bloomsLevel '${q.bloomsLevel}' is invalid. Must be one of: ${validBlooms.join(", ")}`),
        { statusCode: 422 }
      );
    }

    // 6. Difficulty level
    if (!validDifficulty.includes(q.difficulty)) {
      throw Object.assign(
        new Error(`${prefix} difficulty '${q.difficulty}' is invalid. Must be Easy, Medium, or Hard`),
        { statusCode: 422 }
      );
    }

    // 7. Explanation non-empty
    if (typeof q.explanation !== "string" || !q.explanation.trim()) {
      throw Object.assign(new Error(`${prefix} explanation must be a non-empty string`), {
        statusCode: 422,
      });
    }

    // 8. Topic non-empty
    if (typeof q.topic !== "string" || !q.topic.trim()) {
      throw Object.assign(new Error(`${prefix} topic must be a non-empty string`), {
        statusCode: 422,
      });
    }

    // 9. Source citation integrity
    const citation = typeof q.sourceCitation === "string" ? q.sourceCitation.trim() : "";
    if (isGrounded && !citation) {
      throw Object.assign(
        new Error(`${prefix} grounded questions must provide a non-empty sourceCitation referencing course materials`),
        { statusCode: 422 }
      );
    }

    validated.push({
      question: q.question.trim(),
      options: trimmedOptions,
      correctOptionIndex: q.correctOptionIndex,
      explanation: q.explanation.trim(),
      bloomsLevel: q.bloomsLevel,
      difficulty: q.difficulty,
      topic: q.topic.trim(),
      sourceCitation: citation,
    });
  }

  return validated;
}

/**
 * Service to generate syllabus-grounded academic quizzes using Gemini 3.7 Flash and pgvector RAG.
 */
export async function generateQuizQuestions(
  input: GenerateQuizInput,
  userId: string,
  role: string
): Promise<GenerateQuizResponseData> {
  const { courseId, topic, difficulty = "Medium", questionCount = 3, materialIds, saveImmediately = false } = input;

  if (!courseId || !courseId.trim()) {
    throw Object.assign(new Error("courseId is required"), { statusCode: 400 });
  }

  if (!topic || !topic.trim()) {
    throw Object.assign(new Error("topic is required"), { statusCode: 400 });
  }

  // 1. Verify course existence and permissions
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, code: true, title: true, facultyId: true },
  });

  if (!course) {
    throw Object.assign(new Error("Course not found"), { statusCode: 404 });
  }

  if (role !== "ADMIN" && course.facultyId !== userId) {
    throw Object.assign(
      new Error("Forbidden: You can only generate quizzes for courses you instruct"),
      { statusCode: 403 }
    );
  }

  // Clamp question count between 1 and 10
  const effectiveCount = Math.max(1, Math.min(10, Number(questionCount) || 3));

  // 2. Vector Semantic Retrieval via pgvector
  let retrievedChunks: Array<{
    chunkId: string;
    materialId: string;
    documentName: string;
    unit: string;
    pageNumber: number | null;
    content: string;
    tokenCount: number;
    similarity: number;
    distance: number;
  }> = [];

  try {
    const retrieval = await ragService.retrieveRelevantChunksWithTiming(topic.trim(), courseId, {
      topK: 6,
      minSimilarity: 0.40,
    });
    retrievedChunks = retrieval.chunks || [];
  } catch (err: any) {
    console.warn(`[QUIZ GENERATOR] RAG retrieval failed: ${err.message}. Falling back to ungrounded generation.`);
    retrievedChunks = [];
  }

  // Filter by materialIds if explicitly specified
  if (materialIds && Array.isArray(materialIds) && materialIds.length > 0) {
    retrievedChunks = retrievedChunks.filter((c) => materialIds.includes(c.materialId));
  }

  const isGrounded = retrievedChunks.length > 0;
  const groundingNote = isGrounded
    ? `Grounded in ${retrievedChunks.length} course syllabus material chunk(s)`
    : "Not grounded in uploaded course materials. Generated using general curriculum fallback.";

  // Format sources for response
  const sources = retrievedChunks.map((c) => ({
    documentName: c.documentName,
    materialId: c.materialId,
    unit: c.unit,
    page: c.pageNumber,
    chunkId: c.chunkId,
    similarity: Math.round(c.similarity * 100) / 100,
  }));

  // 3. Assemble Prompt
  let contextSection = "";
  if (isGrounded) {
    contextSection = `
[GROUNDED COURSE SYLLABUS MATERIALS]:
${retrievedChunks
  .map(
    (c, idx) =>
      `--- EXCERPT ${idx + 1} ---
Document: ${c.documentName}
Unit: ${c.unit || "General"}
Page: ${c.pageNumber || "N/A"}
Similarity: ${c.similarity.toFixed(3)}
Content:
${c.content}
`
  )
  .join("\n")}
`;
  }

  const prompt = `
You are a distinguished university professor and academic assessment expert designing a formal curriculum quiz.
Course: ${course.code} - ${course.title}
Target Topic: ${topic.trim()}
Target Difficulty: ${difficulty}
Requested Question Count: ${effectiveCount}

${contextSection}

INSTRUCTIONS:
1. Generate an assessment titled concisely for the topic: "${topic.trim()} Assessment".
2. Generate exactly ${effectiveCount} multiple-choice questions.
3. ${
    isGrounded
      ? `GROUNDING INSTRUCTION: Base your questions directly on the syllabus excerpts above. In the "sourceCitation" field of each question, cite the exact document name, unit, and page (e.g. "${retrievedChunks[0].documentName} (Unit: ${retrievedChunks[0].unit || "General"}, Page: ${retrievedChunks[0].pageNumber || "N/A"})").`
      : `GENERAL CURRICULUM FALLBACK: No uploaded course materials matched this topic. Synthesize rigorous questions based on standard general curriculum principles for computer science and engineering. Set "sourceCitation" to empty string ("").`
  }
4. QUESTION REQUIREMENTS:
   - Formulate exactly 4 distinct, plausible answer choices for each question.
   - Ensure exactly one option is unambiguously correct.
   - Set "correctOptionIndex" strictly to the 0-based integer index of the correct answer (0, 1, 2, or 3).
   - Distractors must be technically substantive and plausible, not silly or trivially obvious.
   - Avoid "All of the above" or "None of the above".
   - Provide a clear, educational "explanation" stating why the correct choice is right and other options are false.
   - Assign an appropriate "bloomsLevel" from: Remember, Understand, Apply, Analyze, Evaluate.
   - Assign "difficulty" from: Easy, Medium, Hard.
   - Set "topic" to the specific concept or sub-topic tested.
`;

  // 4. Invoke LLM Provider with Structured JSON Schema
  const llmProvider = getLLMProvider();
  const generationResult = await llmProvider.generateCompletion(prompt, {
    responseMimeType: "application/json",
    responseSchema: QuizResponseSchema,
    temperature: 0.3,
  });

  // 5. Parse JSON Output
  let parsed: any;
  try {
    let cleanJson = generationResult.text.trim();
    if (cleanJson.startsWith("```json")) {
      cleanJson = cleanJson.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
    } else if (cleanJson.startsWith("```")) {
      cleanJson = cleanJson.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }
    parsed = JSON.parse(cleanJson);
  } catch (parseError: any) {
    console.error("[QUIZ GENERATOR] Failed to parse model JSON:", generationResult.text);
    throw Object.assign(
      new Error(`Model generated invalid JSON output: ${parseError.message}`),
      { statusCode: 502 }
    );
  }

  // 6. Mandatory Server-Side Validation
  const validatedQuestions = validateGeneratedQuestions(parsed.questions, isGrounded);

  const quizTitle =
    typeof parsed.quizTitle === "string" && parsed.quizTitle.trim()
      ? parsed.quizTitle.trim()
      : `${topic.trim()} Assessment (${difficulty})`;

  // 7. Preview vs Publish Lifecycle Check
  let persistedQuiz: any = null;

  if (saveImmediately) {
    const timeLimit = Math.max(5, Math.min(180, Number(input.timeLimitMinutes) || 20));

    persistedQuiz = await prisma.quiz.create({
      data: {
        courseId,
        title: quizTitle,
        topic: topic.trim(),
        difficulty: difficulty as Difficulty,
        timeLimitMinutes: timeLimit,
        totalQuestions: validatedQuestions.length,
        isAiGenerated: true,
        published: true,
        questions: {
          create: validatedQuestions.map((q, idx) => ({
            question: q.question,
            options: q.options,
            correctOptionIndex: q.correctOptionIndex,
            explanation: q.explanation,
            topic: q.topic,
            difficulty: q.difficulty,
            bloomsLevel: q.bloomsLevel,
            orderIndex: idx + 1,
          })),
        },
      },
      include: {
        questions: {
          orderBy: { orderIndex: "asc" },
        },
      },
    });
  }

  return {
    quizTitle,
    topic: topic.trim(),
    difficulty: difficulty as Difficulty,
    courseId,
    isGrounded,
    groundingNote,
    sources,
    questions: validatedQuestions,
    quiz: persistedQuiz,
  };
}
