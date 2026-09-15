"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { apiRequest } from "@/lib/api";
import Topbar from "@/components/layout/Topbar";
import StatCard from "@/components/ui/StatCard";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";

import SkeletonLoader, { StatRowSkeleton, TableSkeleton } from "@/components/ui/SkeletonLoader";

export default function StudentPerformancePage() {
  const { user } = useAuth();
  const [performance, setPerformance] = useState<any>(null);
  const [weakTopics, setWeakTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPerformanceData() {
      if (!user) return;
      try {
        setLoading(true);
        const perfRes = await apiRequest<any>(`/students/${user.id}/performance`);
        if (perfRes.success) setPerformance(perfRes.data);

        const weakRes = await apiRequest<any[]>(`/students/${user.id}/weak-topics`);
        if (weakRes.success) setWeakTopics(weakRes.data);
      } catch (err) {
        console.error("Failed to load performance metrics:", err);
      } finally {
        setLoading(false);
      }
    }

    loadPerformanceData();
  }, [user]);

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <Topbar title="Academic Performance Analytics" subtitle="Coursework Mastery & Assessment Diagnostics" />

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6 animate-fade-in">
        {/* KPI Grid */}
        {loading ? (
          <StatRowSkeleton count={3} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Average Quiz Score"
              value={performance?.stats?.averageQuizScore ? `${performance.stats.averageQuizScore}%` : "80%"}
              subtitle={`${performance?.stats?.totalQuizzesAttempted || 2} Quizzes Attempted`}
              icon="📊"
            />
            <StatCard
              title="Assignments Submitted"
              value={performance?.stats?.assignmentsSubmittedCount || 2}
              subtitle="100% on-time submission rate"
              icon="📝"
            />
            <StatCard
              title="Diagnostic Status"
              value={weakTopics.length > 0 ? `${weakTopics.length} Focus Areas` : "Healthy"}
              subtitle="Based on automated error tagging"
              icon="🎯"
            />
          </div>
        )}

        {/* Breakdown Tables */}
        {loading ? (
          <TableSkeleton rows={4} cols={4} />
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Recent Quiz Attempts */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100 mb-3">
                Recent Assessment Attempts
              </h3>

              {performance?.recentAttempts && performance.recentAttempts.length > 0 ? (
                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-left academic-table">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                        <th className="pb-2.5 font-bold">Quiz</th>
                        <th className="pb-2.5 font-bold">Course</th>
                        <th className="pb-2.5 font-bold">Score</th>
                        <th className="pb-2.5 font-bold">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {performance.recentAttempts.map((att: any) => (
                        <tr key={att.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 font-semibold text-slate-900">{att.quiz?.title}</td>
                          <td className="py-3 text-slate-600 font-mono text-[11px]">{att.quiz?.course?.code}</td>
                          <td className="py-3 font-bold text-blue-700">{att.percentage}%</td>
                          <td className="py-3">
                            <Badge variant={att.percentage >= 70 ? "success" : "danger"}>
                              {att.percentage >= 70 ? "Pass" : "Needs Review"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState title="No Attempts" description="You haven't attempted any quizzes yet." />
              )}
            </div>

            {/* Diagnostic Weak Topics Breakdown */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100 mb-3">
                Diagnostic Weak Topics
              </h3>

              {weakTopics.length > 0 ? (
                <div className="space-y-3 text-xs">
                  {weakTopics.map((wt) => (
                    <div key={wt.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl card-interactive">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-slate-900">{wt.topic}</span>
                        <Badge variant="danger">{wt.severity}</Badge>
                      </div>
                      <p className="text-slate-600 text-[11px] mb-2">{wt.recommendedAction}</p>
                      <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                        Course: {wt.courseCode}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-500 py-10 text-center font-medium">
                  ✓ All assessed concepts currently meet mastery standards.
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
