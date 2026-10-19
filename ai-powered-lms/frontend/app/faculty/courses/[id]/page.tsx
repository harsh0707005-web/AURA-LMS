"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import { Course } from "@/lib/types";
import Topbar from "@/components/layout/Topbar";
import EmptyState from "@/components/ui/EmptyState";
import { CardSkeleton, TableSkeleton } from "@/components/ui/SkeletonLoader";

interface EnrolledStudentItem {
  enrollmentId: string;
  name: string;
  enrollmentNo?: string;
  department?: string;
  progressPercentage: number;
  enrolledAt: string;
}

export default function FacultyCourseConsolePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const courseId = resolvedParams.id;

  const [course, setCourse] = useState<Course | null>(null);
  const [students, setStudents] = useState<EnrolledStudentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const cRes = await apiRequest<Course>(`/courses/${courseId}`);
        if (cRes.success && cRes.data) setCourse(cRes.data);

        const sRes = await apiRequest<EnrolledStudentItem[]>(`/courses/${courseId}/students`);
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
      <div className="flex-1 flex flex-col bg-surface min-h-screen text-on-surface">
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
      <div className="flex-1 flex flex-col bg-surface min-h-screen text-on-surface">
        <Topbar title="Course Not Found" />
        <div className="p-12 text-center">
          <EmptyState title="Course Not Found" description="The requested course does not exist." />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-surface min-h-screen text-on-surface">
      <Topbar
        title={`${course.code}: Course Console`}
        subtitle={`${course.title} • Semester ${course.semester}`}
      />

      <main className="flex-1 p-6 sm:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Course Identity Header Card */}
        <header className="rounded-2xl bg-surface-container-lowest border border-outline-variant/40 p-6 sm:p-7 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary shadow-xs">
                <span className="material-symbols-outlined text-[30px]">memory</span>
              </div>
              <div className="flex flex-col">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="px-2.5 py-0.5 rounded-md bg-surface-container-high text-primary font-bold border border-outline-variant/40 text-[10px] tracking-wider uppercase font-mono">
                    {course.code}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md bg-surface-container-low text-on-surface-variant font-medium text-[11px]">
                    Semester {course.semester}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md bg-surface-container-low text-on-surface-variant font-medium text-[11px]">
                    {course.credits} Credits
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-on-surface tracking-tight">
                  {course.title}
                </h1>
                <p className="text-xs text-on-surface-variant mt-1.5 max-w-3xl leading-relaxed">
                  {course.description}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end justify-between gap-4 shrink-0 md:border-l md:border-outline-variant/30 md:pl-6">
              <div className="text-left md:text-right">
                <div className="text-3xl font-bold text-primary font-mono">{students.length}</div>
                <div className="text-[10px] text-outline font-semibold uppercase tracking-wider mt-0.5 font-mono">
                  Enrolled Students
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/faculty/materials"
                  className="px-3.5 py-1.5 bg-surface-container-low border border-outline-variant/50 hover:bg-surface-container text-on-surface font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[15px]">upload_file</span>
                  <span>Upload PDF</span>
                </Link>
                <Link
                  href="/faculty/quizzes"
                  className="px-3.5 py-1.5 bg-primary hover:bg-primary-container text-on-primary font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[15px]">auto_awesome</span>
                  <span>AI Quiz</span>
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* Course Elements Grid (3 Hub Cards) */}
        <div className="grid md:grid-cols-3 gap-5">
          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-5.5 shadow-xs text-xs space-y-3 hover:border-primary/40 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="material-symbols-outlined text-primary text-[22px]">menu_book</span>
                <span className="px-2 py-0.5 rounded bg-surface-container font-mono text-[11px] font-bold text-primary">
                  {course.materials?.length || 0} Files
                </span>
              </div>
              <h3 className="font-bold text-on-surface text-sm">Course Knowledge Base</h3>
              <p className="text-on-surface-variant text-[11px] leading-relaxed mt-1">
                Syllabus PDF files and RAG vector chunks grounded for AI tutor and assessment synthesis.
              </p>
            </div>
            <Link
              href="/faculty/materials"
              className="inline-flex items-center gap-1 font-bold text-primary hover:text-primary-container transition-colors pt-2 border-t border-outline-variant/20"
            >
              <span>Manage Documents</span>
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </Link>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-5.5 shadow-xs text-xs space-y-3 hover:border-primary/40 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="material-symbols-outlined text-secondary text-[22px]">assignment</span>
                <span className="px-2 py-0.5 rounded bg-surface-container font-mono text-[11px] font-bold text-secondary">
                  {course.assignments?.length || 0} Posted
                </span>
              </div>
              <h3 className="font-bold text-on-surface text-sm">Assignments & Grading</h3>
              <p className="text-on-surface-variant text-[11px] leading-relaxed mt-1">
                Problem sets, lab criteria, rubric evaluation, and student submission reviews.
              </p>
            </div>
            <Link
              href="/faculty/assignments"
              className="inline-flex items-center gap-1 font-bold text-secondary hover:text-on-secondary-container transition-colors pt-2 border-t border-outline-variant/20"
            >
              <span>Manage Assignments</span>
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </Link>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-5.5 shadow-xs text-xs space-y-3 hover:border-primary/40 transition-all flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="material-symbols-outlined text-tertiary text-[22px]">quiz</span>
                <span className="px-2 py-0.5 rounded bg-surface-container font-mono text-[11px] font-bold text-tertiary">
                  {course.quizzes?.length || 0} Active
                </span>
              </div>
              <h3 className="font-bold text-on-surface text-sm">Assessments & Quizzes</h3>
              <p className="text-on-surface-variant text-[11px] leading-relaxed mt-1">
                Topic assessments, test banks, and automated diagnostic questions generated with Gemini.
              </p>
            </div>
            <Link
              href="/faculty/quizzes"
              className="inline-flex items-center gap-1 font-bold text-tertiary hover:text-primary transition-colors pt-2 border-t border-outline-variant/20"
            >
              <span>Manage Quizzes</span>
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </Link>
          </div>
        </div>

        {/* Enrolled Students Roster */}
        <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-6 shadow-xs">
          <div className="flex items-center justify-between pb-3.5 border-b border-outline-variant/30 mb-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">groups</span>
              <h3 className="text-sm font-bold text-on-surface">
                Enrolled Student Roster ({students.length})
              </h3>
            </div>
            <span className="font-mono text-[11px] text-outline font-semibold uppercase">Active Cohort</span>
          </div>

          {students.length > 0 ? (
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-outline-variant/30 text-outline uppercase text-[10px] tracking-wider font-mono">
                    <th className="pb-2.5 font-bold">Student</th>
                    <th className="pb-2.5 font-bold">Enrollment No</th>
                    <th className="pb-2.5 font-bold">Department</th>
                    <th className="pb-2.5 font-bold">Progress</th>
                    <th className="pb-2.5 font-bold">Enrolled Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {students.map((s) => (
                    <tr key={s.enrollmentId} className="hover:bg-surface-container-low/70 transition-colors">
                      <td className="py-3 font-bold text-on-surface">{s.name}</td>
                      <td className="py-3 font-mono text-on-surface-variant text-[11px]">{s.enrollmentNo || "N/A"}</td>
                      <td className="py-3 text-on-surface-variant">{s.department || "Computer Engineering"}</td>
                      <td className="py-3 font-semibold text-primary font-mono">{s.progressPercentage}%</td>
                      <td className="py-3 text-on-surface-variant">{new Date(s.enrolledAt).toLocaleDateString()}</td>
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
