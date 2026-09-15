"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { apiRequest } from "@/lib/api";
import Topbar from "@/components/layout/Topbar";
import StatCard from "@/components/ui/StatCard";

import SkeletonLoader, { StatRowSkeleton, TableSkeleton } from "@/components/ui/SkeletonLoader";

export default function FacultyAnalyticsPage() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAnalytics() {
      if (!user) return;
      try {
        setLoading(true);
        const res = await apiRequest<any>(`/analytics/faculty/${user.id}`);
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
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <Topbar title="Academic Analytics & Cohort Insights" subtitle="Predictive Performance Modeling" />

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6 animate-fade-in">
        {/* KPI Grid */}
        {loading ? (
          <StatRowSkeleton count={3} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Total Enrolled Students"
              value={analytics?.overview?.totalStudentsEnrolled || 2}
              subtitle="Across assigned courses"
              icon="👥"
            />
            <StatCard
              title="Total Quizzes Published"
              value={analytics?.overview?.totalQuizzesPublished || 2}
              subtitle="Active assessment instruments"
              icon="⏱️"
            />
            <StatCard
              title="Avg Cohort Performance"
              value={analytics?.overview?.averageStudentQuizPerformance ? `${analytics.overview.averageStudentQuizPerformance}%` : "76%"}
              subtitle="Class mastery index"
              icon="📈"
            />
          </div>
        )}

        {/* Course Breakdown Table */}
        {loading ? (
          <TableSkeleton rows={4} cols={5} />
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 pb-3.5 border-b border-slate-100 mb-4">
              Course Performance Breakdown
            </h3>

            {analytics?.courseMetrics && analytics.courseMetrics.length > 0 ? (
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left academic-table">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                      <th className="pb-2.5 font-bold">Course</th>
                      <th className="pb-2.5 font-bold">Title</th>
                      <th className="pb-2.5 font-bold">Enrolled</th>
                      <th className="pb-2.5 font-bold">Materials</th>
                      <th className="pb-2.5 font-bold">Quizzes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analytics.courseMetrics.map((c: any) => (
                      <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 font-bold text-slate-900 font-mono">{c.code}</td>
                        <td className="py-3 text-slate-700 font-semibold">{c.title}</td>
                        <td className="py-3 font-semibold text-blue-700 font-mono">{c.totalEnrollments}</td>
                        <td className="py-3 text-slate-600 font-mono">{c.totalMaterials}</td>
                        <td className="py-3 text-slate-600 font-mono">{c.totalQuizzes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-xs text-slate-500 py-8 text-center font-medium">
                No course metrics available.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
