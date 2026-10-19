"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { apiRequest } from "@/lib/api";
import Topbar from "@/components/layout/Topbar";
import StatCard from "@/components/ui/StatCard";
import { StatRowSkeleton, TableSkeleton } from "@/components/ui/SkeletonLoader";

interface FacultyCourseMetric {
  id: string;
  code: string;
  title: string;
  totalEnrollments: number;
  totalMaterials: number;
  totalQuizzes: number;
}

interface FacultyAnalyticsPayload {
  overview?: {
    totalStudentsEnrolled?: number;
    totalQuizzesPublished?: number;
    averageStudentQuizPerformance?: number;
  };
  courseMetrics?: FacultyCourseMetric[];
}

export default function FacultyAnalyticsPage() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<FacultyAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAnalytics() {
      if (!user) return;
      try {
        setLoading(true);
        const res = await apiRequest<FacultyAnalyticsPayload>(`/analytics/faculty/${user.id}`);
        if (res.success && res.data) {
          setAnalytics(res.data);
        }
      } catch (err) {
        console.error("Failed to load analytics:", err);
      } finally {
        setLoading(false);
      }
    }

    loadAnalytics();
  }, [user]);

  return (
    <div className="flex-1 flex flex-col bg-surface min-h-screen text-on-surface">
      <Topbar title="Academic Analytics & Cohort Insights" subtitle="Predictive Performance Modeling" />

      <main className="flex-1 p-6 sm:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* KPI Grid */}
        {loading ? (
          <StatRowSkeleton count={3} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Total Enrolled Students"
              value={analytics?.overview?.totalStudentsEnrolled ?? 0}
              subtitle="Across assigned courses"
              icon="groups"
            />
            <StatCard
              title="Total Quizzes Published"
              value={analytics?.overview?.totalQuizzesPublished ?? 0}
              subtitle="Active assessment instruments"
              icon="quiz"
            />
            <StatCard
              title="Avg Cohort Performance"
              value={
                analytics?.overview?.averageStudentQuizPerformance != null
                  ? `${analytics.overview.averageStudentQuizPerformance}%`
                  : "N/A"
              }
              subtitle="Class mastery index"
              icon="monitoring"
            />
          </div>
        )}

        {/* Course Breakdown Table */}
        {loading ? (
          <TableSkeleton rows={4} cols={5} />
        ) : (
          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3.5 border-b border-outline-variant/30">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">analytics</span>
                <h3 className="text-sm font-bold text-on-surface">Course Performance Breakdown</h3>
              </div>
              <span className="font-mono text-[11px] text-outline font-semibold uppercase">Telemetry Data</span>
            </div>

            {analytics?.courseMetrics && analytics.courseMetrics.length > 0 ? (
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-outline-variant/30 text-outline uppercase text-[10px] tracking-wider font-mono">
                      <th className="pb-2.5 font-bold">Course</th>
                      <th className="pb-2.5 font-bold">Title</th>
                      <th className="pb-2.5 font-bold text-center">Enrolled</th>
                      <th className="pb-2.5 font-bold text-center">Materials</th>
                      <th className="pb-2.5 font-bold text-center">Quizzes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    {analytics.courseMetrics.map((c) => (
                      <tr key={c.id} className="hover:bg-surface-container-low/70 transition-colors">
                        <td className="py-3.5 font-bold text-primary font-mono">{c.code}</td>
                        <td className="py-3.5 text-on-surface font-semibold">{c.title}</td>
                        <td className="py-3.5 text-center font-mono font-bold text-primary">{c.totalEnrollments}</td>
                        <td className="py-3.5 text-center font-mono text-on-surface-variant">{c.totalMaterials}</td>
                        <td className="py-3.5 text-center font-mono text-on-surface-variant">{c.totalQuizzes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-xs text-on-surface-variant py-8 text-center font-medium">
                No course metrics available for current instructional assignment.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
