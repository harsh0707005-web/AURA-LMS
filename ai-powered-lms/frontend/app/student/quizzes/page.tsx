"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { apiRequest } from "@/lib/api";
import { Course, Quiz } from "@/lib/types";
import Topbar from "@/components/layout/Topbar";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";

import SkeletonLoader, { CardSkeleton } from "@/components/ui/SkeletonLoader";

export default function StudentQuizzesPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!user) return;
      try {
        setLoading(true);
        const coursesRes = await apiRequest<Course[]>(`/students/${user.id}/courses`);
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
    }

    loadData();
  }, [user]);

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <Topbar title="Topic Assessments & Quizzes" subtitle="Interactive Self-Evaluations & Diagnostics" />

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6 animate-fade-in">
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <CardSkeleton count={6} />
          </div>
        ) : quizzes.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quizzes.map((q) => (
              <div
                key={q.id}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between text-xs space-y-4 card-interactive"
              >
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <Badge variant="info">{q.difficulty}</Badge>
                    <span className="text-slate-500 font-medium text-[11px]">⏱️ {q.timeLimitMinutes} mins</span>
                  </div>

                  <div className="flex items-center space-x-2 mb-2">
                    {q.course && (
                      <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-900 font-bold border border-blue-200 text-[10px] tracking-wider uppercase">
                        {q.course.code}
                      </span>
                    )}
                    <span className="text-slate-500 font-medium text-[11px]">{q.totalQuestions} Questions</span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 mb-1 leading-snug">{q.title}</h3>
                  <p className="text-slate-600 text-[11px] leading-relaxed">Syllabus Topic: {q.topic}</p>
                </div>

                <div className="pt-3.5 border-t border-slate-100">
                  <Link
                    href={`/student/quizzes/${q.id}`}
                    className="block text-center w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg shadow-xs transition-all btn-press"
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
            description="There are currently no active quizzes assigned to your enrolled courses."
          />
        )}
      </main>
    </div>
  );
}
