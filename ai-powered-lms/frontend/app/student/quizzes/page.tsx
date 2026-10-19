"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { apiRequest } from "@/lib/api";
import { Course, Quiz } from "@/lib/types";
import Topbar from "@/components/layout/Topbar";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/SkeletonLoader";

export default function StudentQuizzesPage() {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!user) return;
      try {
        setLoading(true);
        const coursesRes = await apiRequest<Course[]>(`/students/${user.id}/courses`);
        if (coursesRes.success && coursesRes.data) {

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
    }

    loadData();
  }, [user]);

  return (
    <div className="flex-1 flex flex-col bg-surface min-h-screen text-on-surface">
      <Topbar
        title="Topic Assessments & Quizzes"
        subtitle="Interactive Self-Evaluations & Diagnostics"
      />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 animate-fade-in">
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <CardSkeleton count={6} />
          </div>
        ) : quizzes.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quizzes.map((q) => (
              <div
                key={q.id}
                className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-5 shadow-sm flex flex-col justify-between text-xs space-y-4 hover:border-outline-variant transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <Badge variant="info">{q.difficulty}</Badge>
                    <span className="font-label-sm text-outline text-[11px]">
                      ⏱️ {q.timeLimitMinutes} mins
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    {q.course && (
                      <span className="px-2.5 py-0.5 rounded-md bg-primary-fixed text-primary font-bold border border-primary/20 font-label-sm text-[10px] tracking-wider uppercase">
                        {q.course.code}
                      </span>
                    )}
                    <span className="font-label-sm text-outline text-[11px]">
                      {q.totalQuestions} Questions
                    </span>
                  </div>

                  <h3 className="font-headline-sm text-sm font-bold text-on-surface mb-1 leading-snug">
                    {q.title}
                  </h3>
                  <p className="font-body-sm text-on-surface-variant text-[11px] leading-relaxed">
                    Syllabus Topic: {q.topic}
                  </p>
                </div>

                <div className="pt-3.5 border-t border-surface-container-high">
                  <Link
                    href={`/student/quizzes/${q.id}`}
                    className="block text-center w-full py-2.5 bg-primary-container hover:opacity-90 text-on-primary font-semibold rounded-xl shadow-xs transition-opacity"
                  >
                    Start Assessment →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No Quizzes Active"
            description="Your enrolled courses have no active diagnostic quizzes right now."
            actionText="Check Learning Materials"
            actionHref="/student/materials"
          />
        )}
      </main>
    </div>
  );
}
