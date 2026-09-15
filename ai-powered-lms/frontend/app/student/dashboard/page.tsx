"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { apiRequest } from "@/lib/api";
import { Course, WeakTopic, Recommendation, QuizAttempt, Assignment } from "@/lib/types";
import Topbar from "@/components/layout/Topbar";
import StatCard from "@/components/ui/StatCard";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import AIChatBox from "@/components/tutor/AIChatBox";
import { StatRowSkeleton, CardSkeleton } from "@/components/ui/SkeletonLoader";

export default function StudentDashboard() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [performance, setPerformance] = useState<any>(null);
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
        const perfRes = await apiRequest<any>(`/students/${user.id}/performance`);
        if (perfRes.success) setPerformance(perfRes.data);

        // 3. Fetch Weak Topics
        const weakRes = await apiRequest<WeakTopic[]>(`/students/${user.id}/weak-topics`);
        if (weakRes.success) setWeakTopics(weakRes.data);

        // 4. Fetch Recommendations
        const recsRes = await apiRequest<Recommendation[]>(`/students/${user.id}/recommendations`);
        if (recsRes.success) setRecommendations(recsRes.data);
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
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <Topbar
        title="Student Learning Workspace"
        subtitle={`Welcome back, ${user?.name || "Student"} • ${user?.enrollmentNo || "BE-2022-CS-104"}`}
      />

      <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-6">
        {loading ? (
          <div className="space-y-6">
            <StatRowSkeleton />
            <CardSkeleton count={3} />
          </div>
        ) : (
          <>
            {/* KPI Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Enrolled Courses"
                value={courses.length}
                subtitle="Semester 8 Curriculum"
                icon="📚"
              />
              <StatCard
                title="Avg Quiz Score"
                value={performance?.stats?.averageQuizScore ? `${performance.stats.averageQuizScore}%` : "82%"}
                subtitle={`${performance?.stats?.totalQuizzesAttempted || 2} Assessments Taken`}
                icon="⏱️"
                trend={{ value: "4.2%", isPositive: true }}
              />
              <StatCard
                title="Active Deadlines"
                value={upcomingAssignments.length || 2}
                subtitle="Next due in 2 days"
                icon="📝"
              />
              <StatCard
                title="Weak Topics Tagged"
                value={weakTopics.length}
                subtitle="Diagnostic suggestions ready"
                icon="🎯"
              />
            </div>

            {/* Main 2-Column Grid: Workspace + Side AI Assistant */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Columns: Core Academic Workspace */}
              <div className="lg:col-span-2 space-y-6">
                {/* 1. Continue Learning Hero Module */}
                {activeCourse ? (
                  <div className="card-interactive p-6 group">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/80 font-mono">
                          Continue Learning
                        </span>
                        <span className="text-xs text-slate-500 font-medium font-mono">{activeCourse.code}</span>
                      </div>
                      <Link
                        href={`/student/courses/${activeCourse.id}`}
                        className="btn-press text-xs font-semibold text-blue-700 hover:text-blue-900"
                      >
                        View All Modules →
                      </Link>
                    </div>

                    <div className="space-y-3.5">
                      <div>
                        <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-blue-900 transition-colors font-sans">
                          {activeCourse.title}
                        </h3>
                        <p className="text-xs text-slate-600 line-clamp-2 mt-1 leading-relaxed">
                          {activeCourse.description}
                        </p>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1.5 font-mono">
                          <span>Module Completion Progress</span>
                          <span className="text-blue-700 font-bold">{activeCourse.progressPercentage || 65}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-blue-700 h-2 rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${activeCourse.progressPercentage || 65}%` }}
                          />
                        </div>
                      </div>

                      <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs text-slate-500">
                          Instructor: <span className="font-semibold text-slate-700">{activeCourse.faculty?.name || "Faculty Member"}</span>
                        </div>

                        <Link
                          href={`/student/courses/${activeCourse.id}`}
                          className="btn-press bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold px-4 py-2 rounded-md shadow-xs transition-colors flex items-center space-x-1"
                        >
                          <span>Resume Coursework</span>
                          <span>→</span>
                        </Link>
                      </div>
                    </div>
                  </div>
            ) : (
              <EmptyState
                title="No Courses Enrolled"
                description="You are not yet enrolled in any active course modules."
                actionText="Browse Courses"
                actionHref="/student/courses"
              />
            )}

            {/* 2. Upcoming Academic Deadlines Table */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <h3 className="text-sm font-bold text-slate-900">Upcoming Academic Deadlines</h3>
                <Link href="/student/assignments" className="text-xs font-semibold text-blue-700 hover:underline">
                  All Assignments
                </Link>
              </div>

              {upcomingAssignments.length > 0 ? (
                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                        <th className="pb-2">Assignment</th>
                        <th className="pb-2">Course</th>
                        <th className="pb-2">Due Date</th>
                        <th className="pb-2">Points</th>
                        <th className="pb-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {upcomingAssignments.map((a) => (
                        <tr key={a.id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 font-semibold text-slate-900">{a.title}</td>
                          <td className="py-2.5 text-slate-600 font-medium">{a.course?.code || "CS-401"}</td>
                          <td className="py-2.5 text-slate-600">
                            {new Date(a.dueDate).toLocaleDateString()}
                          </td>
                          <td className="py-2.5 text-slate-600 font-semibold">{a.totalPoints} pts</td>
                          <td className="py-2.5">
                            <Badge variant={a.submissions && a.submissions.length > 0 ? "success" : "warning"}>
                              {a.submissions && a.submissions.length > 0 ? "Submitted" : "Pending"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-xs text-slate-500 py-3 text-center">No immediate deadlines pending.</div>
              )}
            </div>

            {/* 3. Diagnostic Weak Topics & Recommendations */}
            <div className="grid sm:grid-cols-2 gap-4">
              {/* Weak Topics */}
              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                  <h3 className="text-sm font-bold text-slate-900">Weak Topics Identified</h3>
                  <Badge variant="danger">{weakTopics.length} Tagged</Badge>
                </div>

                {weakTopics.length > 0 ? (
                  <div className="space-y-2.5">
                    {weakTopics.map((wt) => (
                      <div
                        key={wt.id}
                        className="p-2.5 bg-slate-50 border border-slate-200 rounded-md text-xs"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-slate-900">{wt.topic}</span>
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                            {wt.courseCode}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600">{wt.recommendedAction}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 py-4 text-center">
                    All assessed concepts currently meet mastery standards.
                  </div>
                )}
              </div>

              {/* Actionable Recommendations */}
              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                  <h3 className="text-sm font-bold text-slate-900">Targeted Study Actions</h3>
                  <Link href="/student/recommendations" className="text-xs font-semibold text-blue-700">
                    View All
                  </Link>
                </div>

                {recommendations.length > 0 ? (
                  <div className="space-y-2.5">
                    {recommendations.slice(0, 2).map((rec) => (
                      <div
                        key={rec.id}
                        className="p-2.5 bg-blue-50/50 border border-blue-200 rounded-md text-xs"
                      >
                        <div className="font-bold text-blue-900 mb-0.5">{rec.title}</div>
                        <p className="text-[11px] text-slate-600 mb-1.5">{rec.reason}</p>
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span>⏱️ {rec.estimatedMinutes} mins</span>
                          <span className="font-semibold text-blue-800 uppercase">{rec.type}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 py-4 text-center">
                    No active study recommendations at this time.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Grounded AI Tutor Context Panel */}
          <div className="lg:col-span-1">
            <AIChatBox courses={courses} />
          </div>
        </div>
      </>
    )}
  </main>
</div>
);
}
