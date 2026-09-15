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
    } catch (err: any) {
      alert(err.message || "Failed to submit quiz attempt");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
        <Topbar title="Loading Assessment..." />
        <div className="p-12 text-center text-xs text-slate-500">Preparing quiz questions...</div>
      </div>
    );
  }

  if (!quiz || !quiz.questions || quiz.questions.length === 0) {
    return (
      <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
        <Topbar title="Quiz Unavailable" />
        <div className="p-12 text-center text-xs text-slate-500">
          This quiz is empty or unavailable.
        </div>
      </div>
    );
  }

  const questions = quiz.questions;
  const currentQ = questions[currentQuestionIndex];
  const allAnswered = questions.every((q) => selectedAnswers[q.id] !== undefined);

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <Topbar
        title={`${quiz.title}`}
        subtitle={`${quiz.course?.code || "Course"} • Topic: ${quiz.topic}`}
      />

      <main className="flex-1 p-6 max-w-4xl mx-auto w-full space-y-6 animate-fade-in">
        {/* Results Screen */}
        {submittedAttempt ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-7 shadow-xs space-y-6 text-xs">
            <div className="text-center pb-6 border-b border-slate-100">
              <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-3xl shadow-xs">
                {submittedAttempt.percentage >= 80 ? "🏆" : submittedAttempt.percentage >= 60 ? "👍" : "⚠️"}
              </div>
              <h2 className="text-xl font-bold text-slate-900">Assessment Completed</h2>
              <p className="text-slate-500 mt-1">Your attempt has been scored and analyzed by the evaluation engine.</p>

              <div className="flex justify-center items-center space-x-8 mt-5">
                <div className="text-center bg-slate-50 border border-slate-200 rounded-xl px-6 py-3">
                  <div className="text-3xl font-black text-blue-700">{submittedAttempt.percentage}%</div>
                  <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">Overall Score</div>
                </div>
                <div className="text-center bg-slate-50 border border-slate-200 rounded-xl px-6 py-3">
                  <div className="text-3xl font-black text-slate-800">
                    {submittedAttempt.score} / {submittedAttempt.totalPoints}
                  </div>
                  <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">Total Points</div>
                </div>
              </div>
            </div>

            {/* Weak Topics Diagnostic Alert */}
            {submittedAttempt.weakTopicsIdentified && submittedAttempt.weakTopicsIdentified.length > 0 && (
              <div className="p-4.5 bg-rose-50 border border-rose-200 rounded-xl animate-fade-in">
                <div className="font-bold text-rose-950 mb-1 flex items-center space-x-2">
                  <span>⚠️</span>
                  <span>Diagnostic Weak Topics Detected</span>
                </div>
                <p className="text-rose-700 mb-3 text-[11px]">
                  The diagnostic engine identified mastery gaps in the following syllabus topics:
                </p>
                <div className="flex flex-wrap gap-2">
                  {submittedAttempt.weakTopicsIdentified.map((topic, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 bg-white border border-rose-300 text-rose-900 rounded-lg font-semibold text-[11px] shadow-2xs"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Questions Review */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Question Review & Explanations</h3>
              {questions.map((q, idx) => {
                const userSelected = selectedAnswers[q.id];
                return (
                  <div key={q.id} className="p-4.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="font-bold text-slate-900 leading-snug">
                      Q{idx + 1}. {q.question}
                    </div>

                    <div className="space-y-2 pl-1">
                      {q.options.map((opt, optIdx) => {
                        const isChosen = userSelected === optIdx;
                        return (
                          <div
                            key={optIdx}
                            className={`p-2.5 rounded-lg border text-[11px] transition-colors ${
                              isChosen
                                ? "bg-blue-100/80 border-blue-400 font-semibold text-blue-950"
                                : "bg-white border-slate-200 text-slate-700"
                            }`}
                          >
                            {opt} {isChosen && "(Your Answer)"}
                          </div>
                        );
                      })}
                    </div>

                    {q.explanation && (
                      <div className="mt-2.5 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-[11px] leading-relaxed">
                        <strong className="block font-bold text-blue-950 mb-0.5">Academic Rationale:</strong> {q.explanation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-4 flex justify-between items-center">
              <Link
                href="/student/quizzes"
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition-colors cursor-pointer"
              >
                ← Back to Quizzes
              </Link>
              <Link
                href="/student/recommendations"
                className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-semibold shadow-xs transition-all btn-press cursor-pointer"
              >
                View Diagnostic Recommendations →
              </Link>
            </div>
          </div>
        ) : (
          /* Active Quiz Interface */
          <div className="bg-white border border-slate-200 rounded-2xl p-7 shadow-xs space-y-6 text-xs">
            {/* Quiz Progress Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <span className="font-bold text-slate-900 text-sm">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </span>
                <Badge variant="info">{currentQ.difficulty}</Badge>
              </div>

              <div className="font-semibold text-slate-700 bg-slate-100 border border-slate-200/80 px-3 py-1 rounded-lg text-[11px]">
                ⏱️ Time Limit: {quiz.timeLimitMinutes} mins
              </div>
            </div>

            {/* Question Card */}
            <div className="space-y-4">
              <div className="text-sm font-bold text-slate-900 leading-snug">
                {currentQ.question}
              </div>

              <div className="space-y-2.5">
                {currentQ.options.map((opt, optIdx) => {
                  const isSelected = selectedAnswers[currentQ.id] === optIdx;
                  return (
                    <label
                      key={optIdx}
                      onClick={() => handleSelectOption(currentQ.id, optIdx)}
                      className={`flex items-center space-x-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-blue-50 border-blue-600 text-blue-950 font-semibold shadow-2xs"
                          : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 text-slate-700"
                      }`}
                    >
                      <input
                        type="radio"
                        name={currentQ.id}
                        checked={isSelected}
                        onChange={() => {}}
                        className="text-blue-700 h-4 w-4"
                      />
                      <span className="text-xs">{opt}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Pagination & Submission Controls */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                disabled={currentQuestionIndex === 0}
                onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 font-semibold cursor-pointer transition-colors"
              >
                ← Previous
              </button>

              <div className="flex space-x-1.5">
                {questions.map((q, idx) => (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQuestionIndex(idx)}
                    className={`h-8 w-8 rounded-lg font-bold text-xs cursor-pointer transition-all btn-press ${
                      currentQuestionIndex === idx
                        ? "bg-blue-700 text-white shadow-2xs"
                        : selectedAnswers[q.id] !== undefined
                        ? "bg-blue-100 text-blue-900 border border-blue-200"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>

              {currentQuestionIndex < questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentQuestionIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                  className="px-5 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 active:scale-95 text-white font-semibold shadow-xs cursor-pointer transition-all btn-press"
                >
                  Next →
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!allAnswered || submitting}
                  onClick={handleSubmitQuiz}
                  className="px-5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 active:scale-95 disabled:opacity-50 text-white font-semibold shadow-xs cursor-pointer transition-all btn-press"
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
