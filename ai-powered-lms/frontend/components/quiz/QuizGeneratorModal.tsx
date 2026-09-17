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

  const handleGeneratePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId || !topic.trim()) {
      setErrorMessage("Please select a course and specify a syllabus topic");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const res = await apiRequest("/ai/generate-quiz", {
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
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to generate quiz preview");
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!previewData || !courseId) return;

    if (!previewData.isGrounded && !fallbackAcknowledged) {
      setErrorMessage("Please acknowledge the general curriculum fallback before publishing.");
      return;
    }

    setPublishing(true);
    setErrorMessage("");

    try {
      await apiRequest(`/courses/${courseId}/quizzes`, {
        method: "POST",
        body: JSON.stringify({
          title: previewData.quizTitle || `${topic.trim()} Assessment (${difficulty})`,
          topic: topic.trim(),
          difficulty,
          timeLimitMinutes: timeLimit,
          isAiGenerated: true,
          questions: previewData.questions,
        }),
      });

      onQuizCreated();
      handleClose();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to publish quiz");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-lg max-w-2xl w-full p-6 shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4 shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {step === "preview" ? "Review AI-Generated Assessment" : "Create Academic Quiz with AI"}
            </h3>
            <p className="text-xs text-slate-500">
              {step === "preview"
                ? "Review question citations and Bloom's cognitive taxonomy before publishing"
                : "Generate syllabus-grounded assessments using Gemini 3.7 Flash"}
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={loading || publishing}
            className="text-slate-400 hover:text-slate-700 text-lg font-bold cursor-pointer disabled:opacity-50"
          >
            ×
          </button>
        </div>

        {errorMessage && (
          <div className="mb-4 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded shrink-0">
            {errorMessage}
          </div>
        )}

        {/* Step 1: Configuration Form */}
        {step === "configure" && (
          <form onSubmit={handleGeneratePreview} className="space-y-4 text-xs overflow-y-auto pr-1">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Target Course</label>
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded p-2 text-slate-800 focus:outline-none focus:border-blue-600 font-medium"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code}: {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Syllabus Topic</label>
              <input
                type="text"
                required
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Raft Consensus Algorithm, ARM Interrupts, B+ Tree Indexing"
                className="w-full bg-white border border-slate-200 rounded p-2 text-slate-800 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Difficulty</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as any)}
                  className="w-full bg-white border border-slate-200 rounded p-2 text-slate-800 focus:outline-none focus:border-blue-600"
                >
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Questions</label>
                <select
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded p-2 text-slate-800 focus:outline-none focus:border-blue-600"
                >
                  <option value={2}>2 Questions</option>
                  <option value={3}>3 Questions</option>
                  <option value={5}>5 Questions</option>
                  <option value={10}>10 Questions</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Time Limit (mins)</label>
                <input
                  type="number"
                  min={5}
                  max={180}
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded p-2 text-slate-800 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="px-4 py-2 rounded text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 rounded bg-blue-700 hover:bg-blue-800 text-white font-semibold shadow-xs transition-colors cursor-pointer flex items-center space-x-1.5 disabled:opacity-60"
              >
                {loading && (
                  <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                )}
                <span>{loading ? "Synthesizing with Gemini 3.7 Flash..." : "Generate Preview →"}</span>
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Interactive Preview & Review */}
        {step === "preview" && previewData && (
          <div className="flex flex-col flex-1 overflow-hidden text-xs">
            {/* Grounding Banner */}
            {previewData.isGrounded ? (
              <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded shrink-0">
                <div className="flex items-center space-x-1.5 font-semibold text-emerald-800">
                  <span>✓ Grounded in Course Syllabus</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                    {previewData.sources.length} chunk{previewData.sources.length === 1 ? "" : "s"} cited
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-emerald-700 truncate">
                  Cited sources: {previewData.sources.map((s) => s.documentName).filter((v, i, a) => a.indexOf(v) === i).join(", ")}
                </div>
              </div>
            ) : (
              <div className="mb-3 p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded shrink-0">
                <div className="font-semibold text-amber-800 flex items-center space-x-1.5">
                  <span>⚠️ General Curriculum Fallback</span>
                </div>
                <p className="mt-1 text-[11px] text-amber-700 leading-relaxed">
                  This quiz was generated from standard academic curriculum standards because no matching course notes were found. Questions are not verified against course-specific materials.
                </p>
                <label className="mt-2.5 flex items-center space-x-2 text-amber-900 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fallbackAcknowledged}
                    onChange={(e) => setFallbackAcknowledged(e.target.checked)}
                    className="rounded border-amber-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>I acknowledge that this quiz uses general curriculum fallback and not course materials.</span>
                </label>
              </div>
            )}

            {/* Questions Preview List */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-3">
              {previewData.questions.map((q, qIdx) => (
                <div key={qIdx} className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-slate-800">
                      {qIdx + 1}. {q.question}
                    </span>
                    <div className="flex items-center space-x-1.5 shrink-0">
                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-medium rounded">
                        {q.bloomsLevel}
                      </span>
                      <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-medium rounded">
                        {q.difficulty}
                      </span>
                    </div>
                  </div>

                  {/* Options */}
                  <div className="space-y-1.5 pl-2">
                    {q.options.map((opt, optIdx) => {
                      const isCorrect = optIdx === q.correctOptionIndex;
                      return (
                        <div
                          key={optIdx}
                          className={`p-2 rounded text-xs flex items-center justify-between border ${
                            isCorrect
                              ? "bg-emerald-50/80 border-emerald-300 text-emerald-950 font-medium"
                              : "bg-white border-slate-200 text-slate-700"
                          }`}
                        >
                          <span>
                            <strong className="mr-1.5 font-semibold text-slate-600">
                              {String.fromCharCode(65 + optIdx)}.
                            </strong>
                            {opt}
                          </span>
                          {isCorrect && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded shrink-0">
                              ✓ Correct Answer
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation & Citation */}
                  <div className="pt-2 border-t border-slate-200 text-[11px] space-y-1 text-slate-600">
                    <p>
                      <strong className="text-slate-700">Explanation:</strong> {q.explanation}
                    </p>
                    {q.sourceCitation && (
                      <p className="text-blue-700 font-medium">
                        <strong className="text-slate-700">Source:</strong> {q.sourceCitation}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setStep("configure")}
                disabled={publishing}
                className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 font-semibold rounded cursor-pointer"
              >
                ← Back / Edit Parameters
              </button>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={(e) => handleGeneratePreview(e as any)}
                  disabled={loading || publishing}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold rounded cursor-pointer"
                >
                  Regenerate
                </button>
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={publishing || (!previewData.isGrounded && !fallbackAcknowledged)}
                  className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded shadow-xs transition-colors cursor-pointer flex items-center space-x-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
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
