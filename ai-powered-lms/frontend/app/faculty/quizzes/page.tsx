"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { apiRequest } from "@/lib/api";
import { Course, Quiz } from "@/lib/types";
import Topbar from "@/components/layout/Topbar";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import QuizGeneratorModal from "@/components/quiz/QuizGeneratorModal";
import { CardSkeleton } from "@/components/ui/SkeletonLoader";

export default function FacultyQuizzesPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadData = React.useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const coursesRes = await apiRequest<Course[]>(`/faculty/${user.id}/courses`);
      if (coursesRes.success && coursesRes.data) {
        setCourses(coursesRes.data);

        const allQuizzes: Quiz[] = [];
        for (const c of coursesRes.data) {
          const qRes = await apiRequest<Quiz[]>(`/courses/${c.id}/quizzes`);
          if (qRes.success && qRes.data) {
            const mapped = qRes.data.map((q) => ({
              ...q,
              course: { id: c.id, code: c.code, title: c.title },
            }));
            allQuizzes.push(...mapped);
          }
        }
        setQuizzes(allQuizzes);
      }
    } catch (err) {
      console.error("Failed to load quizzes:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const handleDeleteQuiz = async (quizId: string) => {
    if (!confirm("Are you sure you want to delete this quiz and all student attempts?")) return;
    try {
      await apiRequest(`/quizzes/${quizId}`, { method: "DELETE" });
      loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete quiz");
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-surface min-h-screen text-on-surface">
      <Topbar title="Assessments & Test Banks" subtitle="Manage Topic Quizzes & Diagnostic Questions" />

      <main className="flex-1 p-6 sm:p-8 max-w-7xl mx-auto w-full space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-on-surface">Course Assessments</h2>
            <p className="text-xs text-on-surface-variant">Design syllabus-grounded quizzes with automatic error tagging</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2.5 bg-primary hover:bg-primary-container text-on-primary font-semibold text-xs rounded-lg shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
            <span>+ Create & Publish Quiz</span>
          </button>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <CardSkeleton count={6} />
          </div>
        ) : quizzes.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quizzes.map((q) => (
              <div
                key={q.id}
                className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-5.5 shadow-xs flex flex-col justify-between text-xs space-y-4 hover:border-primary/40 hover:shadow-sm transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <Badge variant={q.difficulty === "Hard" ? "danger" : q.difficulty === "Medium" ? "warning" : "success"}>
                      {q.difficulty}
                    </Badge>
                    <span className="text-on-surface-variant font-medium text-[11px] flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px] text-outline">timer</span>
                      {q.timeLimitMinutes} mins
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 mb-2">
                    {q.course && (
                      <span className="px-2.5 py-0.5 rounded-md bg-surface-container-high text-primary font-bold border border-outline-variant/40 text-[10px] tracking-wider uppercase font-mono">
                        {q.course.code}
                      </span>
                    )}
                    <span className="text-on-surface-variant font-medium text-[11px]">{q.totalQuestions} Questions</span>
                  </div>

                  <h3 className="text-sm font-bold text-on-surface mb-1 leading-snug">{q.title}</h3>
                  <p className="text-on-surface-variant text-[11px] leading-relaxed">
                    Syllabus Topic: {q.topic}
                  </p>
                </div>

                <div className="pt-3.5 border-t border-outline-variant/30 flex items-center justify-between">
                  <span className="text-on-surface-variant font-medium text-[11px] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px] text-outline">group</span>
                    {q._count?.attempts || 0} Student Attempts
                  </span>

                  <button
                    onClick={() => handleDeleteQuiz(q.id)}
                    className="px-2.5 py-1 text-xs text-error hover:bg-error-container/40 border border-error/30 rounded-lg font-semibold transition-all cursor-pointer inline-flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">delete</span>
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No Quizzes Active"
            description="You haven't authored any quizzes yet."
            actionText="Create Quiz"
            onAction={() => setIsModalOpen(true)}
          />
        )}

        <QuizGeneratorModal
          courses={courses}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onQuizCreated={() => {
            loadData();
          }}
        />
      </main>
    </div>
  );
}
