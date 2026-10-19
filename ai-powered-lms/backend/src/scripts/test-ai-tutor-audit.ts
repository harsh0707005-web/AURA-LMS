import "dotenv/config";
import prisma from "../lib/prisma.js";
import { ragService } from "../services/ai/rag.service.js";
import { studentContextService } from "../services/ai/student-context.service.js";
import { geminiProvider } from "../services/ai/gemini.provider.js";

interface BenchmarkResult {
  scenario: string;
  totalMs: number;
  embeddingMs: number;
  vectorSearchMs: number;
  retrievalMs: number;
  rawCandidateCount: number;
  acceptedCandidateCount: number;
  retrievalStatus: string;
  generationMs: number;
  thinkingBudget: number;
  modelRequested?: string;
  modelResponding?: string;
  provider?: string;
  providerAttemptCount?: number;
  providerAttempts?: Array<{ model: string; attempt: number; outcome: string; status?: number; code?: string; error?: string }>;
  fallbackUsed?: boolean;
  retryCount?: number;
  backoffMs?: number;
  promptChars?: number;
  outputChars?: number;
  generationError?: string;
  grounded: boolean;
  sourceCount: number;
  personalizationAvailable: boolean;
}

function safeErrorMessage(error: any): string {
  return String(error?.message || error || "Unknown error")
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[REDACTED_KEY]")
    .replace(/[A-Za-z0-9_-]{35,}/g, "[REDACTED_TOKEN]")
    .slice(0, 1000);
}

async function runBenchmark() {
  console.log("==================================================");
  console.log("AURA LMS: AI TUTOR PERFORMANCE & PERSONALIZATION BENCHMARK");
  console.log("==================================================");

  // 1. Locate student and course
  const student = await prisma.user.findFirst({
    where: { email: "harsh.ce@college.edu" },
    include: {
      enrollments: { include: { course: true } },
      quizAttempts: true,
    },
  });

  if (!student) {
    throw new Error("Test student harsh.ce@college.edu not found in database.");
  }

  const course = await prisma.course.findFirst({
    where: { code: "CS-401" },
  });

  if (!course) {
    throw new Error("Course CS-401 not found.");
  }

  console.log(`[TEST CONTEXT] Student record located; identity omitted from benchmark logs.`);
  console.log(`[TEST CONTEXT] Course record located; course details omitted from benchmark logs.`);

  // Fetch educational profile
  const profile = await studentContextService.getStudentEducationalProfile(student.id, course.id);
  console.log(`[PROFILE] Personalization available: ${profile.isAvailable}; fields omitted from benchmark logs.`);
  console.log(`[PROVIDER] Groq live benchmark: ${process.env.GROQ_API_KEY ? "available when explicitly selected" : "blocked: GROQ_API_KEY is not configured"}`);

  const scenarios = [
    {
      name: "1. Simple Question",
      query: "What is a distributed system in computer engineering?",
      history: [],
    },
    {
      name: "2. Course-Specific Question",
      query: "Explain how the Raft consensus leader election mechanism works with randomized election timeouts.",
      history: [],
    },
    {
      name: "3. Follow-Up Question",
      query: "What happens if two candidate nodes timeout and request votes at the exact same time?",
      history: [
        {
          sender: "user",
          content: "Explain how the Raft consensus leader election mechanism works with randomized election timeouts.",
        },
        {
          sender: "assistant",
          content: "In Raft, follower nodes maintain an election timer. If a follower does not receive heartbeats, it transitions to candidate, increments the current term, and votes for itself...",
        },
      ],
    },
    {
      name: "4. Weak-Topic Question",
      query: "Can you explain how database normalization decomposes tables into 3NF and BCNF to eliminate anomalies?",
      history: [],
    },
    {
      name: "5. Irrelevant Question",
      query: "How do I bake a chocolate cake with frosting and sprinkles?",
      history: [],
    },
  ];

  const results: BenchmarkResult[] = [];

  for (const scenario of scenarios) {
    console.log("\n--------------------------------------------------");
    console.log(`RUNNING: ${scenario.name}`);
    console.log("Query text omitted from benchmark logs.");
    console.log("--------------------------------------------------");

    const t0 = performance.now();

    // 1. Vector retrieval
    const retrieval = await ragService.retrieveRelevantChunksWithTiming(scenario.query, course.id);

    // 2. Generation with optimized thinking configuration. A provider
    // timeout is a benchmark result, not a reason to skip later scenarios.
    let res: any = null;
    let generationError: any = null;
    try {
      res = await ragService.generateGroundedTutorResponse(
        scenario.query,
        { code: course.code, title: course.title, department: course.department, semester: course.semester },
        retrieval.chunks,
        {
          studentProfile: profile,
          conversationHistory: scenario.history,
          retrievalTiming: {
            embeddingMs: retrieval.embeddingMs,
            vectorSearchMs: retrieval.vectorSearchMs,
            retrievalMs: retrieval.retrievalMs,
            rawCandidateCount: retrieval.rawCandidateCount,
            acceptedCandidateCount: retrieval.acceptedCandidateCount,
            minSimilarity: retrieval.minSimilarity,
            retrievalStatus: retrieval.retrievalStatus,
          },
          // Match the normal course-bound tutor path: never generate an
          // ungrounded course answer when retrieval has no accepted chunks.
          allowUngroundedGeneration: false,
        }
      );
    } catch (error: any) {
      generationError = error;
    }

    const totalMs = Math.round(performance.now() - t0);
    const failedAttempts = Array.isArray(generationError?.details?.attempts)
      ? generationError.details.attempts
      : undefined;
    const providerAttempts = res?.providerAttempts || failedAttempts;
    const generationMs = res?.timing?.generationMs || Math.max(0, totalMs - retrieval.retrievalMs);

    results.push({
      scenario: scenario.name,
      totalMs,
      embeddingMs: res?.timing?.embeddingMs || retrieval.embeddingMs,
      vectorSearchMs: res?.timing?.vectorSearchMs || retrieval.vectorSearchMs,
      retrievalMs: res?.timing?.retrievalMs || retrieval.retrievalMs,
      rawCandidateCount: res?.timing?.rawCandidateCount ?? retrieval.rawCandidateCount,
      acceptedCandidateCount: res?.timing?.acceptedCandidateCount ?? retrieval.acceptedCandidateCount,
      retrievalStatus: res?.timing?.retrievalStatus || retrieval.retrievalStatus,
      generationMs,
      thinkingBudget: res?.timing?.thinkingBudgetUsed ?? 0,
      modelRequested: res?.modelRequested || generationError?.details?.requestedModel,
      modelResponding: res?.modelUsed,
      provider: res?.providerUsed || "gemini",
      providerAttemptCount: res?.timing?.providerAttemptCount ?? providerAttempts?.length,
      providerAttempts: providerAttempts?.map((attempt: any) => ({
        model: attempt.model,
        attempt: attempt.attempt,
        outcome: attempt.outcome,
        status: attempt.status,
        code: attempt.code,
        error: attempt.error,
      })),
      fallbackUsed: res?.timing?.fallbackUsed,
      retryCount: res?.timing?.retryCount ?? generationError?.details?.retryCount,
      backoffMs: res?.timing?.backoffMs ?? generationError?.details?.backoffMs,
      promptChars: res?.timing?.promptChars,
      outputChars: res?.timing?.outputChars,
      generationError: generationError ? safeErrorMessage(generationError) : undefined,
      grounded: res?.isGrounded ?? false,
      sourceCount: res?.sources?.length ?? 0,
      personalizationAvailable: res?.timing?.personalizationAvailable ?? profile.isAvailable,
    });

    if (generationError) {
      console.log(
        `Generation failed after ${totalMs} ms (requested=${generationError?.details?.requestedModel || "unknown"}; ` +
        `Retrieval: ${retrieval.retrievalMs}ms, Candidates: ${retrieval.rawCandidateCount}/${retrieval.acceptedCandidateCount}, ` +
        `Trace: ${JSON.stringify(providerAttempts?.map((attempt: any) => ({ model: attempt.model, attempt: attempt.attempt, outcome: attempt.outcome, status: attempt.status, code: attempt.code, error: attempt.error })) || [])}, ` +
        `Error: ${safeErrorMessage(generationError)})`
      );
    } else {
      console.log(
        `Done in ${totalMs} ms (${res.providerUsed || "provider"} requested=${res.modelRequested || "unknown"}, responding=${res.modelUsed || "unknown"}; ` +
        `Retrieval: ${res.timing?.retrievalMs}ms, Candidates: ${res.timing?.rawCandidateCount}/${res.timing?.acceptedCandidateCount}, ` +
        `Gen: ${res.timing?.generationMs}ms, Attempts: ${res.timing?.providerAttemptCount ?? 0}, ` +
        `Fallback: ${res.timing?.fallbackUsed === true}, Grounded: ${res.isGrounded}, ` +
        `Trace: ${JSON.stringify(res.providerAttempts?.map((attempt: any) => ({ model: attempt.model, attempt: attempt.attempt, outcome: attempt.outcome, status: attempt.status, code: attempt.code, error: attempt.error })) || [])}`
      );
    }
  }

  // Print Summary Table
  console.log("\n==================================================================================================");
  console.log("FINAL BENCHMARK AUDIT SUMMARY TABLE");
  console.log("==================================================================================================");
  console.log(
    "Scenario".padEnd(28) +
      "Total(ms)".padEnd(12) +
      "Embed(ms)".padEnd(12) +
      "Vector(ms)".padEnd(12) +
      "Retrieval".padEnd(12) +
      "Candidates".padEnd(14) +
      "Gen(ms)".padEnd(12) +
      "Provider/model".padEnd(28) +
      "Attempts".padEnd(10) +
      "Budget".padEnd(10) +
      "Grounded".padEnd(10) +
      "Sources".padEnd(10) +
      "Profile"
  );
  console.log("--------------------------------------------------------------------------------------------------");

  for (const r of results) {
    console.log(
      r.scenario.padEnd(28) +
      String(r.totalMs).padEnd(12) +
      String(r.embeddingMs).padEnd(12) +
      String(r.vectorSearchMs).padEnd(12) +
      String(r.retrievalMs).padEnd(12) +
      `${r.rawCandidateCount}/${r.acceptedCandidateCount} ${r.retrievalStatus}`.padEnd(14) +
       String(r.generationMs).padEnd(12) +
       `${r.provider || "?"}/${r.modelResponding || "?"}`.slice(0, 27).padEnd(28) +
       String(r.providerAttemptCount ?? 0).padEnd(10) +
       String(r.thinkingBudget).padEnd(10) +
      String(r.grounded).padEnd(10) +
      String(r.sourceCount).padEnd(10) +
      String(r.personalizationAvailable)
    );
  }

  console.log("==================================================================================================");
  const avgGen = Math.round(results.reduce((acc, r) => acc + r.generationMs, 0) / results.length);
  const avgTotal = Math.round(results.reduce((acc, r) => acc + r.totalMs, 0) / results.length);
  console.log(`- Configured-provider generation average: ${avgGen} ms`);
  console.log(`- Average measured end-to-end latency: ${avgTotal} ms`);
  console.log("- Prompt/output sizes are reported as character counts only; prompt content is never logged.");
  console.log("==================================================================================================");
}

runBenchmark()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Benchmark failed:", err);
    process.exit(1);
  });
