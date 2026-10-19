"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { apiRequest } from "@/lib/api";
import { WeakTopic } from "@/lib/types";
import Topbar from "@/components/layout/Topbar";
import StatCard from "@/components/ui/StatCard";
import Badge from "@/components/ui/Badge";
import { StatRowSkeleton, TableSkeleton } from "@/components/ui/SkeletonLoader";

interface AttemptRecord {
  id: string;
  score: number;
  totalPoints: number;
  percentage: number;
  completedAt: string;
  quiz?: {
    id: string;
    title: string;
    topic: string;
    course?: {
      id: string;
      code: string;
      title: string;
    };
  };
}

interface PerformanceResponse {
  stats?: {
    averageQuizScore?: number;
    totalQuizzesAttempted?: number;
    assignmentsSubmittedCount?: number;
  };
  recentAttempts?: AttemptRecord[];
}

export default function StudentPerformancePage() {
  const { user } = useAuth();
  const [performance, setPerformance] = useState<PerformanceResponse | null>(null);
  const [weakTopics, setWeakTopics] = useState<WeakTopic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPerformanceData() {
      if (!user) return;
      try {
        setLoading(true);
        const perfRes = await apiRequest<PerformanceResponse>(`/students/${user.id}/performance`);
        if (perfRes.success && perfRes.data) setPerformance(perfRes.data);

        const weakRes = await apiRequest<WeakTopic[]>(`/students/${user.id}/weak-topics`);
        if (weakRes.success && weakRes.data) setWeakTopics(weakRes.data);
      } catch (err) {
        console.error("Failed to load performance metrics:", err);
      } finally {
        setLoading(false);
      }
    }

    loadPerformanceData();
  }, [user]);

  return (
    <div className="flex-1 flex flex-col bg-surface min-h-screen text-on-surface">
      <Topbar
        title="Academic Performance Analytics"
        subtitle="Coursework Mastery & Assessment Diagnostics"
      />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 animate-fade-in">
        {/* KPI Grid */}
        {loading ? (
          <StatRowSkeleton count={3} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Average Quiz Score"
              value={
                performance?.stats?.averageQuizScore !== undefined
                  ? `${performance.stats.averageQuizScore}%`
                  : "No attempts"
              }
              subtitle={
                performance?.stats?.totalQuizzesAttempted !== undefined
                  ? `${performance.stats.totalQuizzesAttempted} quizzes attempted`
                  : "Diagnostic baseline pending"
              }
              icon="analytics"
            />
            <StatCard
              title="Assignments Submitted"
              value={performance?.stats?.assignmentsSubmittedCount ?? 0}
              subtitle="Coursework submissions on record"
              icon="assignment_turned_in"
            />
            <StatCard
              title="Diagnostic Status"
              value={weakTopics.length > 0 ? `${weakTopics.length} Focus Areas` : "Healthy"}
              subtitle={
                weakTopics.length > 0
                  ? "Remediation recommended"
                  : "All assessed concepts met standard"
              }
              icon="health_and_safety"
            />
          </div>
        )}

        {/* Breakdown Tables */}
        {loading ? (
          <TableSkeleton rows={4} cols={4} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Quiz Attempts */}
            <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
                <h3 className="font-headline-sm text-sm font-bold text-on-surface">
                  Recent Assessment Attempts
                </h3>
                <span className="font-label-sm text-xs text-outline">
                  {performance?.recentAttempts?.length || 0} Records
                </span>
              </div>

              {performance?.recentAttempts && performance.recentAttempts.length > 0 ? (
                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-surface-container-high font-label-sm text-[10px] text-outline uppercase tracking-wider">
                        <th className="pb-2.5 font-bold">Quiz</th>
                        <th className="pb-2.5 font-bold">Course</th>
                        <th className="pb-2.5 font-bold">Score</th>
                        <th className="pb-2.5 font-bold">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container-high/60">
                      {performance.recentAttempts.map((att) => (
                        <tr key={att.id} className="hover:bg-surface-container-low transition-colors">
                          <td className="py-3 font-semibold text-on-surface">
                            {att.quiz?.title || "Assessment"}
                          </td>
                          <td className="py-3 font-label-sm text-outline text-[11px]">
                            {att.quiz?.course?.code || "—"}
                          </td>
                          <td className="py-3 font-bold text-primary font-label-sm">
                            {att.percentage}%
                          </td>
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
                <div className="text-xs text-on-surface-variant py-8 text-center font-body-sm">
                  No completed assessment attempts on record yet.
                </div>
              )}
            </div>

            {/* Weak Topics Diagnostic Breakdown */}
            <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
                <h3 className="font-headline-sm text-sm font-bold text-on-surface">
                  Diagnostic Weak Topics
                </h3>
                <span className="font-label-sm text-xs text-outline">
                  {weakTopics.length} Focus Areas
                </span>
              </div>

              {weakTopics.length > 0 ? (
                <div className="space-y-3">
                  {weakTopics.map((wt) => (
                    <div
                      key={wt.id}
                      className="p-3.5 bg-surface-container-low border border-surface-container-high rounded-xl text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-on-surface text-sm">{wt.topic}</span>
                        <span className="font-label-sm text-[10px] font-bold text-error bg-error-container px-2 py-0.5 rounded-md">
                          {wt.courseCode}
                        </span>
                      </div>
                      <p className="font-body-sm text-[11px] text-on-surface-variant leading-relaxed">
                        {wt.recommendedAction}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-on-surface-variant py-8 text-center font-body-sm">
                  All assessed topics currently meet institution mastery thresholds.
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
