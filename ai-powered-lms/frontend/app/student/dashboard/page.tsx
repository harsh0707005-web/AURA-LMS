"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { apiRequest } from "@/lib/api";
import { Course, WeakTopic, Recommendation, Assignment } from "@/lib/types";
import Topbar from "@/components/layout/Topbar";
import StatCard from "@/components/ui/StatCard";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import AIChatBox from "@/components/tutor/AIChatBox";
import { StatRowSkeleton, CardSkeleton } from "@/components/ui/SkeletonLoader";

interface StudentPerformanceData {
  stats?: {
    averageQuizScore?: number;
    totalQuizzesAttempted?: number;
    assignmentsSubmittedCount?: number;
  };
  recentAttempts?: unknown[];
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [performance, setPerformance] = useState<StudentPerformanceData | null>(null);
  const [weakTopics, setWeakTopics] = useState<WeakTopic[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [upcomingAssignments, setUpcomingAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      if (!user) return;
      try {
        setLoading(true);
        // 1. Fetch Enrolled Courses
        const coursesRes = await apiRequest<Course[]>(`/students/${user.id}/courses`);
        if (coursesRes.success && coursesRes.data) {
          setCourses(coursesRes.data);

          // Fetch upcoming assignments for first course
          if (coursesRes.data.length > 0) {
            const firstCourseId = coursesRes.data[0].id;
            const assignRes = await apiRequest<Assignment[]>(`/courses/${firstCourseId}/assignments`);
            if (assignRes.success && assignRes.data) {
              setUpcomingAssignments(assignRes.data);
            }
          }
        }

        // 2. Fetch Performance
        const perfRes = await apiRequest<StudentPerformanceData>(`/students/${user.id}/performance`);
        if (perfRes.success && perfRes.data) setPerformance(perfRes.data);

        // 3. Fetch Weak Topics
        const weakRes = await apiRequest<WeakTopic[]>(`/students/${user.id}/weak-topics`);
        if (weakRes.success && weakRes.data) setWeakTopics(weakRes.data);

        // 4. Fetch Recommendations
        const recsRes = await apiRequest<Recommendation[]>(`/students/${user.id}/recommendations`);
        if (recsRes.success && recsRes.data) setRecommendations(recsRes.data);
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, [user]);

  const activeCourse = courses.length > 0 ? courses[0] : null;

  return (
    <div className="flex-1 flex flex-col bg-surface min-h-screen text-on-surface">
      <Topbar
        title="Student Learning Workspace"
        subtitle={`Welcome back, ${user?.name || "Student"} ${
          user?.enrollmentNo ? `• ${user.enrollmentNo}` : ""
        }`}
      />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
        {loading ? (
          <div className="space-y-6">
            <StatRowSkeleton count={4} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <CardSkeleton count={2} />
              </div>
              <div className="lg:col-span-1">
                <CardSkeleton count={1} />
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* KPI Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Enrolled Courses"
                value={courses.length}
                subtitle="Active Curriculum"
                icon="school"
              />
              <StatCard
                title="Avg Quiz Score"
                value={
                  performance?.stats?.averageQuizScore !== undefined
                    ? `${performance.stats.averageQuizScore}%`
                    : "No attempts yet"
                }
                subtitle={
                  performance?.stats?.totalQuizzesAttempted !== undefined
                    ? `${performance.stats.totalQuizzesAttempted} assessments completed`
                    : "Diagnostic baseline pending"
                }
                icon="quiz"
              />
              <StatCard
                title="Pending Deadlines"
                value={upcomingAssignments.length}
                subtitle="Upcoming assignments"
                icon="assignment"
              />
              <StatCard
                title="Weak Topics Tagged"
                value={weakTopics.length}
                subtitle={weakTopics.length > 0 ? "Focus areas identified" : "Mastery healthy"}
                icon="auto_awesome"
              />
            </div>

            {/* Main 2-Column Grid: Workspace + Side AI Assistant */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left 8 Cols: Academic Workspace */}
              <div className="lg:col-span-7 xl:col-span-8 space-y-6">
                {/* 1. Continue Learning Hero Module */}
                {activeCourse ? (
                  <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-6 shadow-sm hover:border-outline-variant transition-all">
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-surface-container-high mb-4">
                      <div className="flex items-center gap-2">
                        <span className="font-label-sm text-[11px] font-bold uppercase tracking-wider text-primary bg-primary-fixed/80 border border-primary/20 px-2.5 py-0.5 rounded-md">
                          Continue Learning
                        </span>
                        <span className="font-label-sm text-xs font-semibold text-outline">
                          {activeCourse.code}
                        </span>
                      </div>
                      <Link
                        href={`/student/courses/${activeCourse.id}`}
                        className="font-body-sm text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                      >
                        <span>View Syllabus Modules</span>
                        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                      </Link>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <h3 className="font-headline-sm text-lg font-bold text-on-surface leading-snug">
                          {activeCourse.title}
                        </h3>
                        {activeCourse.description && (
                          <p className="font-body-sm text-xs text-on-surface-variant line-clamp-2 mt-1 leading-relaxed">
                            {activeCourse.description}
                          </p>
                        )}
                      </div>

                      {/* Course Progress */}
                      <div>
                        <div className="flex justify-between items-center text-xs font-label-sm font-semibold text-on-surface-variant mb-1.5">
                          <span>Syllabus Completion</span>
                          <span className="text-primary font-bold">
                            {activeCourse.progressPercentage !== undefined
                              ? `${activeCourse.progressPercentage}%`
                              : "Enrolled"}
                          </span>
                        </div>
                        <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-primary-container h-full rounded-full transition-all duration-500 ease-out"
                            style={{
                              width: `${activeCourse.progressPercentage || 0}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Action footer */}
                      <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-surface-container-high">
                        <div className="text-xs text-on-surface-variant flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px] text-outline">person</span>
                          <span>Instructor: <strong className="text-on-surface font-semibold">{activeCourse.faculty?.name || "Faculty Member"}</strong></span>
                        </div>

                        <Link
                          href={`/student/courses/${activeCourse.id}`}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-container text-on-primary font-body-sm text-xs font-semibold hover:opacity-95 shadow-xs transition-opacity"
                        >
                          <span>Resume Coursework</span>
                          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    title="No Courses Enrolled"
                    description="You are not currently enrolled in any academic courses."
                    actionText="Browse Course Catalog"
                    actionHref="/student/courses"
                  />
                )}

                {/* 2. Upcoming Academic Deadlines Table */}
                <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined text-[18px]">calendar_clock</span>
                      </div>
                      <h3 className="font-headline-sm text-sm font-bold text-on-surface">
                        Upcoming Academic Deadlines
                      </h3>
                    </div>
                    <Link
                      href="/student/assignments"
                      className="font-body-sm text-xs font-semibold text-primary hover:underline flex items-center gap-0.5"
                    >
                      <span>All Assignments</span>
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </Link>
                  </div>

                  {upcomingAssignments.length > 0 ? (
                    <div className="overflow-x-auto text-xs">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-surface-container-high font-label-sm text-[10px] text-outline uppercase tracking-wider">
                            <th className="pb-2 font-bold">Assignment</th>
                            <th className="pb-2 font-bold">Course</th>
                            <th className="pb-2 font-bold">Due Date</th>
                            <th className="pb-2 font-bold">Points</th>
                            <th className="pb-2 font-bold">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-container-high/60">
                          {upcomingAssignments.map((a) => {
                            const isSubmitted = a.submissions && a.submissions.length > 0;
                            return (
                              <tr key={a.id} className="hover:bg-surface-container-low transition-colors">
                                <td className="py-2.5 font-semibold text-on-surface">{a.title}</td>
                                <td className="py-2.5 font-label-sm text-outline">{a.course?.code || "CS-401"}</td>
                                <td className="py-2.5 text-on-surface-variant font-label-sm text-[11px]">
                                  {new Date(a.dueDate).toLocaleDateString()}
                                </td>
                                <td className="py-2.5 font-label-sm text-on-surface font-semibold">{a.totalPoints} pts</td>
                                <td className="py-2.5">
                                  <Badge variant={isSubmitted ? "success" : "warning"}>
                                    {isSubmitted ? "Submitted" : "Pending"}
                                  </Badge>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-xs text-on-surface-variant py-4 text-center">
                      No immediate assignment deadlines pending.
                    </div>
                  )}
                </div>

                {/* 3. Diagnostic Weak Topics & Actionable Recommendations */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Weak Topics */}
                  <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-surface-container-high">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-error">warning</span>
                        <h3 className="font-headline-sm text-sm font-bold text-on-surface">
                          Weak Topics Identified
                        </h3>
                      </div>
                      <span className="font-label-sm text-[10px] font-bold px-2 py-0.5 rounded bg-error-container text-on-error-container">
                        {weakTopics.length} Tagged
                      </span>
                    </div>

                    {weakTopics.length > 0 ? (
                      <div className="space-y-2">
                        {weakTopics.map((wt) => (
                          <div
                            key={wt.id}
                            className="p-3 bg-surface-container-low border border-surface-container-high rounded-xl text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-on-surface">{wt.topic}</span>
                              <span className="font-label-sm text-[10px] font-bold text-error bg-error-container px-1.5 py-0.5 rounded">
                                {wt.courseCode}
                              </span>
                            </div>
                            <p className="text-[11px] text-on-surface-variant leading-relaxed">
                              {wt.recommendedAction}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-on-surface-variant py-4 text-center">
                        All assessed concepts currently meet mastery standards.
                      </div>
                    )}
                  </div>

                  {/* Recommendations */}
                  <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-surface-container-high">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-primary">auto_awesome</span>
                        <h3 className="font-headline-sm text-sm font-bold text-on-surface">
                          Targeted Study Actions
                        </h3>
                      </div>
                      <Link
                        href="/student/recommendations"
                        className="font-body-sm text-xs font-semibold text-primary hover:underline"
                      >
                        View All
                      </Link>
                    </div>

                    {recommendations.length > 0 ? (
                      <div className="space-y-2">
                        {recommendations.slice(0, 3).map((rec) => (
                          <div
                            key={rec.id}
                            className="p-3 bg-surface-container-low border border-surface-container-high rounded-xl text-xs space-y-1.5"
                          >
                            <div className="font-bold text-on-surface leading-tight">{rec.title}</div>
                            <p className="text-[11px] text-on-surface-variant leading-relaxed">{rec.reason}</p>
                            <div className="flex items-center justify-between font-label-sm text-[10px] text-outline pt-0.5">
                              <span>⏱️ {rec.estimatedMinutes} mins</span>
                              <span className="font-bold text-primary uppercase">{rec.type}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-on-surface-variant py-4 text-center">
                        No active study recommendations at this time.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right 4-5 Cols: Embedded Grounded AI Tutor Context Panel */}
              <div className="lg:col-span-5 xl:col-span-4">
                <AIChatBox courses={courses} />
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
