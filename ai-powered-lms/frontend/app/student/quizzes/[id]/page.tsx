"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import { Quiz, QuizAttempt } from "@/lib/types";
import Topbar from "@/components/layout/Topbar";
import Badge from "@/components/ui/Badge";

export default function StudentQuizTakerPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const quizId = resolvedParams.id;

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [submittedAttempt, setSubmittedAttempt] = useState<QuizAttempt | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadQuiz() {
      try {
        setLoading(true);
        const res = await apiRequest<Quiz>(`/quizzes/${quizId}`);
        if (res.success && res.data) {
          setQuiz(res.data);
        }
      } catch (err) {
        console.error("Failed to load quiz:", err);
      } finally {
        setLoading(false);
      }
    }

    loadQuiz();
  }, [quizId]);

  const handleSelectOption = (questionId: string, optionIndex: number) => {
    if (submittedAttempt) return;
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleSubmitQuiz = async () => {
    if (!quiz || !quiz.questions || submitting) return;

    setSubmitting(true);
    try {
      const answersPayload = quiz.questions.map((q) => ({
        questionId: q.id,
        selectedOptionIndex: selectedAnswers[q.id] !== undefined ? selectedAnswers[q.id] : -1,
      }));

      const res = await apiRequest<QuizAttempt>(`/quizzes/${quiz.id}/attempts`, {
        method: "POST",
        body: JSON.stringify({
          timeSpentSeconds: 300,
          answers: answersPayload,
        }),
      });

      if (res.success && res.data) {
        setSubmittedAttempt(res.data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit quiz attempt";
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col bg-surface min-h-screen text-on-surface">
        <Topbar title="Loading Assessment..." />
        <div className="p-12 text-center text-xs text-on-surface-variant font-label-sm">
          Preparing quiz questions...
        </div>
      </div>
    );
  }

  if (!quiz || !quiz.questions || quiz.questions.length === 0) {
    return (
      <div className="flex-1 flex flex-col bg-surface min-h-screen text-on-surface">
        <Topbar title="Quiz Unavailable" />
        <div className="p-12 text-center text-xs text-on-surface-variant">
          This quiz is empty or unavailable.
        </div>
      </div>
    );
  }

  const questions = quiz.questions;
  const currentQ = questions[currentQuestionIndex];
  const allAnswered = questions.every((q) => selectedAnswers[q.id] !== undefined);

  return (
    <div className="flex-1 flex flex-col bg-surface min-h-screen text-on-surface">
      <Topbar
        title={`${quiz.title}`}
        subtitle={`${quiz.course?.code || "Course"} • Topic: ${quiz.topic}`}
      />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full space-y-6 animate-fade-in">
        {/* Results Screen */}
        {submittedAttempt ? (
          <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-6 sm:p-8 shadow-sm space-y-6 text-xs">
            <div className="text-center pb-6 border-b border-surface-container-high">
              <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-surface-container-low border border-surface-container-high flex items-center justify-center text-3xl shadow-xs">
                {submittedAttempt.percentage >= 80 ? "🏆" : submittedAttempt.percentage >= 60 ? "👍" : "⚠️"}
              </div>
              <h2 className="font-headline-sm text-xl font-bold text-on-surface">
                Assessment Completed
              </h2>
              <p className="font-body-sm text-on-surface-variant mt-1 text-xs">
                Your attempt has been scored and analyzed by the evaluation engine.
              </p>

              <div className="flex justify-center items-center gap-6 mt-6">
                <div className="text-center bg-surface-container-low border border-surface-container-high rounded-2xl px-6 py-3.5">
                  <div className="font-headline-sm text-3xl font-black text-primary">
                    {submittedAttempt.percentage}%
                  </div>
                  <div className="font-label-sm text-[10px] text-outline uppercase tracking-wider mt-0.5">
                    Overall Score
                  </div>
                </div>
                <div className="text-center bg-surface-container-low border border-surface-container-high rounded-2xl px-6 py-3.5">
                  <div className="font-headline-sm text-3xl font-black text-on-surface">
                    {submittedAttempt.score} / {submittedAttempt.totalPoints}
                  </div>
                  <div className="font-label-sm text-[10px] text-outline uppercase tracking-wider mt-0.5">
                    Total Points
                  </div>
                </div>
              </div>
            </div>

            {/* Weak Topics Diagnostic Alert */}
            {submittedAttempt.weakTopicsIdentified && submittedAttempt.weakTopicsIdentified.length > 0 && (
              <div className="p-5 bg-error-container/30 border border-error/30 rounded-2xl space-y-2">
                <div className="font-headline-sm font-bold text-on-error-container text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-error">warning</span>
                  <span>Diagnostic Weak Topics Detected</span>
                </div>
                <p className="font-body-sm text-on-error-container text-[11px]">
                  The diagnostic engine identified mastery gaps in the following syllabus topics:
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {submittedAttempt.weakTopicsIdentified.map((topic, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 bg-surface-container-lowest border border-error/40 text-on-error-container rounded-xl font-semibold text-[11px] shadow-2xs font-label-sm"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Questions Review */}
            <div className="space-y-4 pt-4 border-t border-surface-container-high">
              <h3 className="font-headline-sm font-bold text-on-surface text-sm">
                Question Review & Explanations
              </h3>
              {questions.map((q, idx) => {
                const userSelected = selectedAnswers[q.id];
                return (
                  <div
                    key={q.id}
                    className="p-5 bg-surface-container-low border border-surface-container-high rounded-2xl space-y-3"
                  >
                    <div className="font-headline-sm font-bold text-on-surface leading-snug">
                      Q{idx + 1}. {q.question}
                    </div>

                    <div className="space-y-2 pl-1">
                      {q.options.map((opt, optIdx) => {
                        const isChosen = userSelected === optIdx;
                        return (
                          <div
                            key={optIdx}
                            className={`p-3 rounded-xl border text-[11px] transition-colors ${
                              isChosen
                                ? "bg-primary-fixed/80 border-primary text-primary font-semibold"
                                : "bg-surface-container-lowest border-surface-container-high text-on-surface"
                            }`}
                          >
                            {opt} {isChosen && "(Your Selected Answer)"}
                          </div>
                        );
                      })}
                    </div>

                    {q.explanation && (
                      <div className="mt-2.5 p-3 bg-surface-container-lowest border border-surface-container-high rounded-xl text-on-surface text-[11px] leading-relaxed">
                        <strong className="block font-headline-sm font-bold text-primary mb-0.5">
                          Academic Rationale:
                        </strong>{" "}
                        {q.explanation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-4 flex flex-wrap justify-between items-center gap-3">
              <Link
                href="/student/quizzes"
                className="px-4 py-2.5 bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-semibold rounded-xl transition-colors cursor-pointer"
              >
                ← Back to Quizzes
              </Link>
              <Link
                href="/student/recommendations"
                className="px-5 py-2.5 bg-primary-container hover:opacity-90 text-on-primary rounded-xl font-semibold shadow-xs transition-opacity cursor-pointer"
              >
                View Diagnostic Recommendations →
              </Link>
            </div>
          </div>
        ) : (
          /* Active Quiz Interface */
          <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-6 sm:p-8 shadow-sm space-y-6 text-xs">
            {/* Quiz Progress Header */}
            <div className="flex items-center justify-between pb-4 border-b border-surface-container-high">
              <div className="flex items-center gap-2.5">
                <span className="font-headline-sm font-bold text-on-surface text-sm">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </span>
                <Badge variant="info">{currentQ.difficulty}</Badge>
              </div>

              <div className="font-label-sm text-[11px] font-semibold text-on-surface bg-surface-container px-3 py-1 rounded-xl border border-surface-container-high">
                ⏱️ {quiz.timeLimitMinutes} mins limit
              </div>
            </div>

            {/* Question Card */}
            <div className="space-y-4">
              <div className="font-headline-sm text-sm font-bold text-on-surface leading-snug">
                {currentQ.question}
              </div>

              <div className="space-y-2.5">
                {currentQ.options.map((opt, optIdx) => {
                  const isSelected = selectedAnswers[currentQ.id] === optIdx;
                  return (
                    <label
                      key={optIdx}
                      onClick={() => handleSelectOption(currentQ.id, optIdx)}
                      className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-primary-fixed/60 border-primary text-on-surface font-semibold shadow-2xs"
                          : "bg-surface-container-low border-surface-container-high hover:border-outline-variant text-on-surface-variant"
                      }`}
                    >
                      <input
                        type="radio"
                        name={currentQ.id}
                        checked={isSelected}
                        onChange={() => {}}
                        className="text-primary h-4 w-4"
                      />
                      <span className="text-xs font-body-md">{opt}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Pagination & Submission Controls */}
            <div className="pt-4 border-t border-surface-container-high flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                disabled={currentQuestionIndex === 0}
                onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high disabled:opacity-40 text-on-surface font-semibold cursor-pointer transition-colors"
              >
                ← Previous
              </button>

              <div className="flex gap-1.5 overflow-x-auto py-1">
                {questions.map((q, idx) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentQuestionIndex(idx)}
                    className={`h-8 w-8 rounded-xl font-bold text-xs cursor-pointer transition-all ${
                      currentQuestionIndex === idx
                        ? "bg-primary-container text-on-primary shadow-2xs"
                        : selectedAnswers[q.id] !== undefined
                        ? "bg-primary-fixed text-primary border border-primary/20"
                        : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>

              {currentQuestionIndex < questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setCurrentQuestionIndex((prev) => Math.min(questions.length - 1, prev + 1))
                  }
                  className="px-5 py-2 rounded-xl bg-primary-container hover:opacity-90 text-on-primary font-semibold shadow-xs cursor-pointer transition-opacity"
                >
                  Next →
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!allAnswered || submitting}
                  onClick={handleSubmitQuiz}
                  className="px-5 py-2 rounded-xl bg-secondary text-on-secondary hover:opacity-90 disabled:opacity-50 font-semibold shadow-xs cursor-pointer transition-opacity"
                >
                  {submitting ? "Evaluating..." : "Submit Quiz →"}
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
