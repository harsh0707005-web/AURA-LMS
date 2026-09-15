"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import { Course } from "@/lib/types";
import Topbar from "@/components/layout/Topbar";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";

import SkeletonLoader, { CardSkeleton, TableSkeleton } from "@/components/ui/SkeletonLoader";

export default function FacultyCourseConsolePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const courseId = resolvedParams.id;

  const [course, setCourse] = useState<Course | null>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const cRes = await apiRequest<Course>(`/courses/${courseId}`);
        if (cRes.success && cRes.data) setCourse(cRes.data);

        const sRes = await apiRequest<any[]>(`/courses/${courseId}/students`);
        if (sRes.success && sRes.data) setStudents(sRes.data);
      } catch (err) {
        console.error("Failed to load course details:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [courseId]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
        <Topbar title="Loading Course Console..." />
        <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
          <CardSkeleton count={3} />
          <TableSkeleton rows={4} cols={5} />
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
        <Topbar title="Course Not Found" />
        <div className="p-12 text-center">
          <EmptyState title="Course Not Found" description="The requested course does not exist." />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <Topbar
        title={`${course.code}: Course Console`}
        subtitle={`${course.title} • Semester ${course.semester}`}
      />

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6 animate-fade-in">
        {/* Header summary */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5 mb-2">
              <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-900 font-bold border border-blue-200 text-[10px] tracking-wider uppercase font-mono">
                {course.code}
              </span>
              <span className="text-xs font-semibold text-slate-600">{course.credits} Credits</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">{course.title}</h2>
            <p className="text-xs text-slate-600 max-w-3xl mt-1 leading-relaxed">{course.description}</p>
          </div>

          <div className="text-right sm:border-l sm:border-slate-100 sm:pl-6 shrink-0">
            <div className="text-3xl font-bold text-blue-700 font-mono">{students.length}</div>
            <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">Enrolled Students</div>
          </div>
        </div>

        {/* Course Elements Grid */}
        <div className="grid md:grid-cols-3 gap-5">
          <div className="bg-white border border-slate-200 rounded-xl p-5.5 shadow-xs text-xs space-y-2.5 card-interactive">
            <h3 className="font-bold text-slate-900 text-sm">Course Materials ({course.materials?.length || 0})</h3>
            <p className="text-slate-500 text-[11px] leading-relaxed">Syllabus PDF files and RAG vector chunks grounded for AI tutor.</p>
            <Link href="/faculty/materials" className="inline-block pt-1 font-bold text-blue-700 hover:text-blue-900 transition-colors">
              Manage Documents →
            </Link>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5.5 shadow-xs text-xs space-y-2.5 card-interactive">
            <h3 className="font-bold text-slate-900 text-sm">Assignments ({course.assignments?.length || 0})</h3>
            <p className="text-slate-500 text-[11px] leading-relaxed">Problem sets, rubric criteria, and student submission reviews.</p>
            <Link href="/faculty/assignments" className="inline-block pt-1 font-bold text-blue-700 hover:text-blue-900 transition-colors">
              Manage Assignments →
            </Link>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5.5 shadow-xs text-xs space-y-2.5 card-interactive">
            <h3 className="font-bold text-slate-900 text-sm">Quizzes ({course.quizzes?.length || 0})</h3>
            <p className="text-slate-500 text-[11px] leading-relaxed">Topic assessments, test banks, and automated diagnostic questions.</p>
            <Link href="/faculty/quizzes" className="inline-block pt-1 font-bold text-blue-700 hover:text-blue-900 transition-colors">
              Manage Quizzes →
            </Link>
          </div>
        </div>

        {/* Enrolled Students Roster */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 pb-3.5 border-b border-slate-100 mb-4">
            Enrolled Student Roster ({students.length})
          </h3>

          {students.length > 0 ? (
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left academic-table">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                    <th className="pb-2.5 font-bold">Student</th>
                    <th className="pb-2.5 font-bold">Enrollment No</th>
                    <th className="pb-2.5 font-bold">Department</th>
                    <th className="pb-2.5 font-bold">Progress</th>
                    <th className="pb-2.5 font-bold">Enrolled Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((s) => (
                    <tr key={s.enrollmentId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 font-bold text-slate-900">{s.name}</td>
                      <td className="py-3 font-mono text-slate-600 text-[11px]">{s.enrollmentNo || "N/A"}</td>
                      <td className="py-3 text-slate-600">{s.department || "Computer Engineering"}</td>
                      <td className="py-3 font-semibold text-blue-700 font-mono">{s.progressPercentage}%</td>
                      <td className="py-3 text-slate-500">{new Date(s.enrolledAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No Students Enrolled" description="No students have enrolled in this course yet." />
          )}
        </div>
      </main>
    </div>
  );
}
