"use client";

import React, { useState } from "react";
import { Course } from "@/lib/types";
import { apiRequest } from "@/lib/api";

interface GeneratedQuestionItem {
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
  bloomsLevel: string;
  difficulty: string;
  topic: string;
  sourceCitation?: string;
}

interface PreviewQuizData {
  quizTitle: string;
  topic: string;
  difficulty: "Easy" | "Medium" | "Hard";
  courseId: string;
  isGrounded: boolean;
  groundingNote: string;
  sources: Array<{
    documentName: string;
    materialId: string;
    unit: string;
    page: number | null;
    similarity: number;
  }>;
  questions: GeneratedQuestionItem[];
}

interface QuizGeneratorModalProps {
  courses: Course[];
  isOpen: boolean;
  onClose: () => void;
  onQuizCreated: () => void;
}

export default function QuizGeneratorModal({
  courses,
  isOpen,
  onClose,
  onQuizCreated,
}: QuizGeneratorModalProps) {
  const [courseId, setCourseId] = useState(courses[0]?.id || "");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<"Easy" | "Medium" | "Hard">("Medium");
  const [questionCount, setQuestionCount] = useState(3);
  const [timeLimit, setTimeLimit] = useState(15);
  const [step, setStep] = useState<"configure" | "preview">("configure");
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [previewData, setPreviewData] = useState<PreviewQuizData | null>(null);
  const [fallbackAcknowledged, setFallbackAcknowledged] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    if (loading || publishing) return;
    setStep("configure");
    setPreviewData(null);
    setErrorMessage("");
    setFallbackAcknowledged(false);
    onClose();
  };

  /** Closes the modal unconditionally after a successful publish.
   *  Does NOT check the in-flight guard — publishing is still true
   *  when this is called, so handleClose() would silently bail. */
  const closeAfterSuccess = () => {
    setPreviewData(null);
    setStep("configure");
    setErrorMessage("");
    setFallbackAcknowledged(false);
    onClose();
  };

  const handleGeneratePreview = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!courseId || !topic.trim()) {
      setErrorMessage("Please select a course and specify a syllabus topic");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const res = await apiRequest<PreviewQuizData>("/ai/generate-quiz", {
        method: "POST",
        body: JSON.stringify({
          courseId,
          topic: topic.trim(),
          difficulty,
          questionCount,
          saveImmediately: false,
        }),
      });

      if (res && res.data) {
        setPreviewData(res.data);
        setStep("preview");
        setFallbackAcknowledged(false);
      } else {
        throw new Error("Invalid response received from quiz generation endpoint");
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to generate quiz preview");
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!previewData || !courseId || loading || publishing) return;

    if (!previewData.isGrounded && !fallbackAcknowledged) {
      setErrorMessage("Please acknowledge the general curriculum fallback before publishing.");
      return;
    }

    setPublishing(true);
    setErrorMessage("");

    try {
      const idempotencyKey = `pub_quiz_${courseId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      await apiRequest(`/courses/${courseId}/quizzes`, {
        method: "POST",
        headers: {
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          title: previewData.quizTitle || `${topic.trim()} Assessment (${difficulty})`,
          topic: topic.trim(),
          difficulty,
          timeLimitMinutes: timeLimit,
          isAiGenerated: true,
          fallbackAcknowledged: previewData.isGrounded ? true : fallbackAcknowledged,
          idempotencyKey,
          questions: previewData.questions,
        }),
      });

      onQuizCreated();
      // Dedicated success-close path that bypasses the in-flight guard
      closeAfterSuccess();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to publish quiz");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-2xl max-w-3xl w-full p-6 sm:p-7 shadow-2xl max-h-[92vh] flex flex-col text-on-surface">
        {/* Header & Stepper */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-outline-variant/30 mb-4 shrink-0 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface-container-high text-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[24px]">smart_toy</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-on-surface">
                {step === "preview" ? "Review AI-Generated Assessment" : "AI Assessment Studio"}
              </h3>
              <p className="text-xs text-on-surface-variant">
                {step === "preview"
                  ? "Verify grounding citations, Bloom's cognitive taxonomy, and answer keys"
                  : "LLM-augmented question authoring with syllabus grounding citations"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Status Pills */}
            <div className="flex items-center gap-1.5 rounded-full bg-surface-container px-3 py-1 font-mono text-[10px] text-on-surface font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
              <span>{step === "configure" ? "1. Configuration" : "2. Draft Review"}</span>
            </div>

            <button
              onClick={handleClose}
              disabled={loading || publishing}
              className="text-outline hover:text-on-surface text-lg font-bold cursor-pointer p-1 rounded-lg hover:bg-surface-container transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-error-container text-on-error-container text-xs rounded-xl shrink-0 font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Step 1: Configuration Form */}
        {step === "configure" && (
          <form onSubmit={handleGeneratePreview} className="space-y-4 text-xs overflow-y-auto pr-1">
            <div>
              <label className="block font-semibold text-on-surface mb-1 font-mono text-[11px] uppercase tracking-wider">
                Target Course
              </label>
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg p-2.5 text-on-surface focus:outline-none focus:border-primary font-medium transition-colors"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code}: {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-on-surface mb-1 font-mono text-[11px] uppercase tracking-wider">
                Syllabus Topic / Concept Focus
              </label>
              <input
                type="text"
                required
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Raft Consensus Algorithm, ARM Interrupts, B+ Tree Indexing"
                className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg p-2.5 text-on-surface placeholder:text-outline focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-on-surface mb-1 font-mono text-[11px] uppercase tracking-wider">
                  Target Difficulty
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as "Easy" | "Medium" | "Hard")}
                  className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg p-2.5 text-on-surface focus:outline-none focus:border-primary transition-colors"
                >
                  <option value="Easy">Foundational (Easy)</option>
                  <option value="Medium">Intermediate (Medium)</option>
                  <option value="Hard">Advanced Rigorous (Hard)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-on-surface mb-1 font-mono text-[11px] uppercase tracking-wider">
                  Question Count
                </label>
                <select
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg p-2.5 text-on-surface focus:outline-none focus:border-primary transition-colors"
                >
                  <option value={2}>2 Questions (Quick Check)</option>
                  <option value={3}>3 Questions</option>
                  <option value={5}>5 Questions (Formative)</option>
                  <option value={10}>10 Questions (Benchmark)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-on-surface mb-1 font-mono text-[11px] uppercase tracking-wider">
                  Time Limit (Minutes)
                </label>
                <input
                  type="number"
                  min={5}
                  max={180}
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(Number(e.target.value))}
                  className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg p-2.5 text-on-surface focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-outline-variant/30 flex justify-end space-x-2.5 shrink-0">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="px-4 py-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-semibold shadow-xs transition-all cursor-pointer flex items-center gap-2 disabled:opacity-60"
              >
                {loading && (
                  <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                )}
                <span>{loading ? "Synthesizing with Gemini..." : "Generate AI Preview →"}</span>
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Interactive Preview & Review */}
        {step === "preview" && previewData && (
          <div className="flex flex-col flex-1 overflow-hidden text-xs">
            {/* Grounding Banner */}
            {loading && (
              <div className="mb-3 p-3 bg-surface-container border border-primary/30 text-on-surface rounded-xl shrink-0 flex items-center space-x-2">
                <span className="inline-block w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                <span className="font-semibold text-xs">
                  Regenerating questions with Gemini... Preview is locked.
                </span>
              </div>
            )}
            {previewData.isGrounded ? (
              <div className="mb-3.5 p-3.5 bg-secondary-container/60 border border-secondary-container rounded-xl text-on-surface shrink-0">
                <div className="flex items-center space-x-2 font-semibold text-secondary">
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  <span>Grounded in Course Syllabus Materials</span>
                  <span className="font-mono text-[10px] bg-secondary text-on-secondary px-2 py-0.5 rounded-full font-bold">
                    {previewData.sources.length} chunk{previewData.sources.length === 1 ? "" : "s"} cited
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-on-surface-variant truncate">
                  Cited sources: {previewData.sources.map((s) => s.documentName).filter((v, i, a) => a.indexOf(v) === i).join(", ")}
                </div>
              </div>
            ) : (
              <div className="mb-3.5 p-3.5 bg-amber-500/10 border border-amber-500/30 text-on-surface rounded-xl shrink-0">
                <div className="font-semibold text-amber-700 flex items-center space-x-2">
                  <span className="material-symbols-outlined text-[18px]">warning</span>
                  <span>General Curriculum Fallback</span>
                </div>
                <p className="mt-1 text-[11px] text-on-surface-variant leading-relaxed">
                  This quiz was synthesized from standard curriculum guidelines because no matching lecture notes were found. Questions are not anchored in course-specific uploaded PDFs.
                </p>
                <label className="mt-2.5 flex items-center space-x-2 text-on-surface font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fallbackAcknowledged}
                    onChange={(e) => setFallbackAcknowledged(e.target.checked)}
                    className="rounded text-primary focus:ring-0"
                  />
                  <span>I acknowledge that this quiz uses general curriculum fallback.</span>
                </label>
              </div>
            )}

            {/* Questions Preview List */}
            <div className={`flex-1 overflow-y-auto space-y-4 pr-1.5 mb-3 ${loading ? "opacity-40 pointer-events-none" : ""}`}>
              {previewData.questions.map((q, qIdx) => (
                <div key={qIdx} className="p-4 bg-surface-container-low border border-outline-variant/40 rounded-xl space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-bold text-on-surface text-sm">
                      {qIdx + 1}. {q.question}
                    </span>
                    <div className="flex items-center space-x-1.5 shrink-0">
                      <span className="px-2 py-0.5 bg-surface-container-high text-primary font-mono text-[10px] font-semibold rounded-md">
                        Bloom: {q.bloomsLevel}
                      </span>
                      <span className="px-2 py-0.5 bg-surface-container text-on-surface-variant font-mono text-[10px] font-semibold rounded-md">
                        {q.difficulty}
                      </span>
                    </div>
                  </div>

                  {/* Options */}
                  <div className="space-y-2">
                    {q.options.map((opt, optIdx) => {
                      const isCorrect = optIdx === q.correctOptionIndex;
                      return (
                        <div
                          key={optIdx}
                          className={`p-2.5 rounded-lg text-xs flex items-center justify-between border transition-colors ${
                            isCorrect
                              ? "bg-secondary-container/50 border-secondary/40 text-on-secondary-container font-semibold"
                              : "bg-surface-container-lowest border-outline-variant/30 text-on-surface"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span className="font-mono text-outline font-bold">
                              {String.fromCharCode(65 + optIdx)}.
                            </span>
                            <span>{opt}</span>
                          </span>
                          {isCorrect && (
                            <span className="text-[10px] font-mono font-bold text-secondary bg-secondary-container px-2 py-0.5 rounded shrink-0 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px]">check</span>
                              <span>Correct</span>
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation & Citation */}
                  <div className="pt-2.5 border-t border-outline-variant/30 text-[11px] space-y-1 text-on-surface-variant">
                    <p>
                      <strong className="text-on-surface">Explanation:</strong> {q.explanation}
                    </p>
                    {q.sourceCitation && (
                      <p className="text-primary font-medium flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px]">menu_book</span>
                        <span>Source: {q.sourceCitation}</span>
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="pt-3.5 border-t border-outline-variant/30 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setStep("configure")}
                disabled={loading || publishing}
                className="px-3.5 py-2 text-on-surface-variant hover:bg-surface-container font-semibold rounded-lg cursor-pointer transition-colors disabled:opacity-50"
              >
                ← Edit Parameters
              </button>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleGeneratePreview}
                  disabled={loading || publishing}
                  className="px-3.5 py-2 border border-outline-variant/50 text-on-surface hover:bg-surface-container font-semibold rounded-lg cursor-pointer transition-colors disabled:opacity-50"
                >
                  {loading ? "Regenerating..." : "Regenerate"}
                </button>
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={loading || publishing || (!previewData.isGrounded && !fallbackAcknowledged)}
                  className="px-5 py-2 bg-primary hover:bg-primary-container text-on-primary font-semibold rounded-lg shadow-xs transition-all cursor-pointer flex items-center space-x-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {publishing && (
                    <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  )}
                  <span>{publishing ? "Publishing Quiz..." : "Publish Quiz to Course →"}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
