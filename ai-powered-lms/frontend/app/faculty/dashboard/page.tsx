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
import { StatRowSkeleton, CardSkeleton } from "@/components/ui/SkeletonLoader";

interface FacultyAnalyticsOverview {
  totalStudentsEnrolled?: number;
  averageStudentQuizPerformance?: number;
  totalQuizzesPublished?: number;
}

interface FacultyAnalyticsData {
  overview?: FacultyAnalyticsOverview;
  courseMetrics?: Array<{
    id: string;
    code: string;
    title: string;
    totalEnrollments: number;
    totalMaterials: number;
    totalQuizzes: number;
  }>;
}

export default function FacultyDashboard() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [analytics, setAnalytics] = useState<FacultyAnalyticsData | null>(null);
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
        const analRes = await apiRequest<FacultyAnalyticsData>(`/analytics/faculty/${user.id}`);
        if (analRes.success && analRes.data) {
          setAnalytics(analRes.data);
        }

        // 3. At-Risk Students
        const riskRes = await apiRequest<AtRiskStudent[]>("/analytics/at-risk");
        if (riskRes.success && riskRes.data) {
          setAtRiskStudents(riskRes.data);
        }
      } catch (err) {
        console.error("Failed to load faculty dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadFacultyData();
  }, [user]);

  return (
    <div className="flex-1 flex flex-col bg-surface min-h-screen text-on-surface">
      <Topbar
        title="Faculty Management & Analytics Hub"
        subtitle={`Welcome back, ${user?.name || "Faculty Member"} • ${user?.department || "Dept. of Computer Engineering"}`}
      />

      <main className="flex-1 p-6 sm:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* KPI Row */}
        {loading ? (
          <StatRowSkeleton count={4} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Courses Instructed"
              value={courses.length}
              subtitle="Department Offerings"
              icon="school"
            />
            <StatCard
              title="Enrolled Students"
              value={analytics?.overview?.totalStudentsEnrolled ?? 0}
              subtitle="Active Cohort"
              icon="groups"
            />
            <StatCard
              title="Avg Cohort Mastery"
              value={
                analytics?.overview?.averageStudentQuizPerformance != null
                  ? `${analytics.overview.averageStudentQuizPerformance}%`
                  : "N/A"
              }
              subtitle="Assessment Average"
              icon="insights"
            />
            <StatCard
              title="At-Risk Alerts"
              value={atRiskStudents.length}
              subtitle="Intervention Flagged"
              icon="warning"
            />
          </div>
        )}

        {/* Quick Action Bar */}
        <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center space-x-2.5 text-xs font-semibold text-on-surface">
            <span className="material-symbols-outlined text-primary text-[20px]">bolt</span>
            <span>Instructional Tools & Actions:</span>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => setIsQuizModalOpen(true)}
              className="px-4 py-2 bg-primary text-on-primary hover:bg-primary-container font-semibold text-xs rounded-lg shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
              <span>+ Create & Publish Quiz</span>
            </button>
            <Link
              href="/faculty/materials"
              className="px-4 py-2 bg-surface-container-low border border-outline-variant/50 hover:bg-surface-container text-on-surface font-semibold text-xs rounded-lg shadow-2xs transition-all flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">upload_file</span>
              <span>Upload Lecture Notes</span>
            </Link>
            <Link
              href="/faculty/assignments"
              className="px-4 py-2 bg-surface-container-low border border-outline-variant/50 hover:bg-surface-container text-on-surface font-semibold text-xs rounded-lg shadow-2xs transition-all flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">assignment_turned_in</span>
              <span>Review Submissions</span>
            </Link>
          </div>
        </div>

        {/* Course Overview Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">library_books</span>
              <h3 className="text-sm font-bold text-on-surface">Your Assigned Courses</h3>
            </div>
            <Link
              href="/faculty/courses"
              className="text-xs font-semibold text-primary hover:text-primary-container transition-colors flex items-center gap-1"
            >
              <span>Manage All Courses</span>
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </Link>
          </div>

          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              <CardSkeleton count={3} />
            </div>
          ) : courses.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-5 shadow-xs flex flex-col justify-between text-xs space-y-4 hover:border-primary/40 hover:shadow-sm transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="px-2.5 py-1 rounded-md bg-surface-container-high text-primary font-bold border border-outline-variant/40 text-[10px] tracking-wider uppercase font-mono">
                        {course.code}
                      </span>
                      <span className="text-on-surface-variant font-medium text-[11px]">
                        {course.credits} Credits • Sem {course.semester}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-on-surface mb-1.5 leading-snug">{course.title}</h4>
                    <p className="text-on-surface-variant line-clamp-2 leading-relaxed text-[11px]">
                      {course.description}
                    </p>
                  </div>

                  <div className="pt-3.5 border-t border-outline-variant/30 flex items-center justify-between">
                    <span className="text-on-surface-variant font-medium text-[11px] flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px] text-outline">group</span>
                      {course._count?.enrollments || 0} Students
                    </span>
                    <Link
                      href={`/faculty/courses/${course.id}`}
                      className="font-bold text-primary hover:text-primary-container transition-colors flex items-center gap-0.5"
                    >
                      <span>Course Console</span>
                      <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No Courses Assigned"
              description="You have not created or been assigned any instructional courses yet."
              actionText="Create New Course"
              actionHref="/faculty/courses"
            />
          )}
        </div>

        {/* At-Risk Student Cohort Alert Table */}
        <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-outline-variant/30 mb-4 gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-error text-[20px]">troubleshoot</span>
                <h3 className="text-sm font-bold text-on-surface">Student Risk Diagnostic Indicators</h3>
              </div>
              <p className="text-[11px] text-on-surface-variant mt-0.5">
                Automated detection based on quiz score thresholds (&lt;60%) and low module progress
              </p>
            </div>
            <Badge variant="danger">{atRiskStudents.length} Students Tagged</Badge>
          </div>

          {atRiskStudents.length > 0 ? (
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-outline-variant/30 text-outline uppercase text-[10px] tracking-wider font-mono">
                    <th className="pb-2.5 font-bold">Student Name</th>
                    <th className="pb-2.5 font-bold">Enrollment No.</th>
                    <th className="pb-2.5 font-bold">Course</th>
                    <th className="pb-2.5 font-bold">Avg Quiz Score</th>
                    <th className="pb-2.5 font-bold">Risk Level</th>
                    <th className="pb-2.5 font-bold">Recommended Intervention</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {atRiskStudents.map((s) => (
                    <tr key={s.id} className="hover:bg-surface-container-low/70 transition-colors">
                      <td className="py-3 font-bold text-on-surface">{s.studentName}</td>
                      <td className="py-3 text-on-surface-variant font-mono text-[11px]">{s.enrollmentNo}</td>
                      <td className="py-3 font-semibold text-on-surface">{s.courseCode}</td>
                      <td className="py-3 font-bold text-error font-mono">{s.averageQuizScore}%</td>
                      <td className="py-3">
                        <Badge variant={s.riskLevel === "HIGH" ? "danger" : "warning"}>
                          {s.riskLevel}
                        </Badge>
                      </td>
                      <td className="py-3 text-on-surface-variant text-[11px] max-w-xs">{s.recommendedIntervention}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-xs text-on-surface-variant py-8 text-center font-medium flex items-center justify-center gap-1.5">
              <span className="material-symbols-outlined text-secondary text-[18px]">verified</span>
              <span>No students currently meet at-risk thresholds. All cohorts performing satisfactorily.</span>
            </div>
          )}
        </div>

        {/* Quiz Generator Modal */}
        <QuizGeneratorModal
          courses={courses}
          isOpen={isQuizModalOpen}
          onClose={() => setIsQuizModalOpen(false)}
          onQuizCreated={() => {
            // Trigger feedback
          }}
        />
      </main>
    </div>
  );
}
