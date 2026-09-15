"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { apiRequest } from "@/lib/api";
import { Course, AtRiskStudent } from "@/lib/types";
import Topbar from "@/components/layout/Topbar";
import StatCard from "@/components/ui/StatCard";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import QuizGeneratorModal from "@/components/quiz/QuizGeneratorModal";

import SkeletonLoader, { CardSkeleton, StatRowSkeleton } from "@/components/ui/SkeletonLoader";

export default function FacultyDashboard() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [atRiskStudents, setAtRiskStudents] = useState<AtRiskStudent[]>([]);
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFacultyData() {
      if (!user) return;
      try {
        setLoading(true);
        // 1. Faculty Courses
        const coursesRes = await apiRequest<Course[]>(`/faculty/${user.id}/courses`);
        if (coursesRes.success && coursesRes.data) {
          setCourses(coursesRes.data);
        }

        // 2. Faculty Analytics
        const analRes = await apiRequest<any>(`/analytics/faculty/${user.id}`);
        if (analRes.success) setAnalytics(analRes.data);

        // 3. At-Risk Students
        const riskRes = await apiRequest<AtRiskStudent[]>("/analytics/at-risk");
        if (riskRes.success && riskRes.data) setAtRiskStudents(riskRes.data);
      } catch (err) {
        console.error("Failed to load faculty dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadFacultyData();
  }, [user]);

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <Topbar
        title="Faculty Management & Analytics Hub"
        subtitle={`Welcome back, ${user?.name || "Faculty Member"} • Dept. of Computer Engineering`}
      />

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6 animate-fade-in">
        {/* KPI Row */}
        {loading ? (
          <StatRowSkeleton count={4} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Courses Instructed"
              value={courses.length}
              subtitle="Department of CE"
              icon="📚"
            />
            <StatCard
              title="Enrolled Students"
              value={analytics?.overview?.totalStudentsEnrolled || 2}
              subtitle="Active Semester Cohort"
              icon="👥"
            />
            <StatCard
              title="Avg Cohort Mastery"
              value={analytics?.overview?.averageStudentQuizPerformance ? `${analytics.overview.averageStudentQuizPerformance}%` : "76%"}
              subtitle="Assessment average"
              icon="📊"
            />
            <StatCard
              title="At-Risk Alerts"
              value={atRiskStudents.length}
              subtitle="Intervention needed"
              icon="⚠️"
            />
          </div>
        )}

        {/* Quick Action Bar */}
        <div className="bg-white border border-slate-200 rounded-xl p-4.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
            <span className="text-base">⚡</span>
            <span>Instructional Shortcuts & Tools:</span>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => setIsQuizModalOpen(true)}
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs rounded-lg shadow-xs transition-all cursor-pointer btn-press"
            >
              + Create & Publish Quiz
            </button>
            <Link
              href="/faculty/materials"
              className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg shadow-2xs transition-all btn-press"
            >
              Upload Lecture Notes
            </Link>
            <Link
              href="/faculty/assignments"
              className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg shadow-2xs transition-all btn-press"
            >
              Review Submissions
            </Link>
          </div>
        </div>

        {/* Course Overview Grid */}
        <div className="space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Your Assigned Courses</h3>
            <Link href="/faculty/courses" className="text-xs font-semibold text-blue-700 hover:text-blue-900 transition-colors">
              Manage Courses →
            </Link>
          </div>

          {loading ? (
            <CardSkeleton count={3} />
          ) : courses.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="bg-white border border-slate-200 rounded-xl p-5.5 shadow-xs flex flex-col justify-between text-xs space-y-3.5 card-interactive"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-900 font-bold border border-blue-200 text-[10px] tracking-wider uppercase font-mono">
                        {course.code}
                      </span>
                      <span className="text-slate-500 font-medium text-[11px]">{course.credits} Credits</span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 mb-1.5 leading-snug">{course.title}</h4>
                    <p className="text-slate-600 line-clamp-2 leading-relaxed text-[11px]">{course.description}</p>
                  </div>

                  <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-slate-500 font-medium text-[11px]">
                      {course._count?.enrollments || 0} Enrolled Students
                    </span>
                    <Link
                      href={`/faculty/courses/${course.id}`}
                      className="font-bold text-blue-700 hover:text-blue-900 transition-colors"
                    >
                      Course Dashboard →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No Courses Assigned" description="You have not created or been assigned any courses." />
          )}
        </div>

        {/* At-Risk Student Cohort Alert Table */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Student Risk Diagnostic Indicators</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Automated detection based on quiz score thresholds (&lt;60%) and low module progress
              </p>
            </div>
            <Badge variant="danger">{atRiskStudents.length} Students Tagged</Badge>
          </div>

          {atRiskStudents.length > 0 ? (
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left academic-table">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                    <th className="pb-2.5 font-bold">Student Name</th>
                    <th className="pb-2.5 font-bold">Enrollment No.</th>
                    <th className="pb-2.5 font-bold">Course</th>
                    <th className="pb-2.5 font-bold">Avg Quiz Score</th>
                    <th className="pb-2.5 font-bold">Risk Level</th>
                    <th className="pb-2.5 font-bold">Recommended Intervention</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {atRiskStudents.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 font-bold text-slate-900">{s.studentName}</td>
                      <td className="py-3 text-slate-600 font-mono text-[11px]">{s.enrollmentNo}</td>
                      <td className="py-3 font-semibold text-slate-700">{s.courseCode}</td>
                      <td className="py-3 font-bold text-rose-700 font-mono">{s.averageQuizScore}%</td>
                      <td className="py-3">
                        <Badge variant={s.riskLevel === "HIGH" ? "danger" : "warning"}>
                          {s.riskLevel}
                        </Badge>
                      </td>
                      <td className="py-3 text-slate-600 text-[11px]">{s.recommendedIntervention}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-xs text-slate-500 py-8 text-center font-medium">
              ✓ No students currently meet at-risk thresholds.
            </div>
          )}
        </div>

        {/* Quiz Generator Modal */}
        <QuizGeneratorModal
          courses={courses}
          isOpen={isQuizModalOpen}
          onClose={() => setIsQuizModalOpen(false)}
          onQuizCreated={() => {
            alert("Quiz created and published successfully!");
          }}
        />
      </main>
    </div>
  );
}
