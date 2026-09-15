"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { apiRequest } from "@/lib/api";
import { Recommendation } from "@/lib/types";
import Topbar from "@/components/layout/Topbar";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";

import SkeletonLoader, { CardSkeleton } from "@/components/ui/SkeletonLoader";

export default function StudentRecommendationsPage() {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRecs() {
      if (!user) return;
      try {
        setLoading(true);
        const res = await apiRequest<Recommendation[]>(`/students/${user.id}/recommendations`);
        if (res.success && res.data) {
          setRecommendations(res.data);
        }
      } catch (err) {
        console.error("Failed to load recommendations:", err);
      } finally {
        setLoading(false);
      }
    }

    loadRecs();
  }, [user]);

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <Topbar
        title="Personalized Study Recommendations"
        subtitle="Automated Remediations from Assessment Diagnostics"
      />

      <main className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-6 animate-fade-in">
        <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-4.5 text-xs text-blue-950 leading-relaxed shadow-2xs flex items-start space-x-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 text-base">
            💡
          </div>
          <div>
            <strong className="block font-bold text-blue-900 mb-0.5">How Recommendations Work:</strong>
            AURA LMS analyzes incorrect quiz answers and low module mastery scores to generate targeted review tasks, practice retests, and AI Tutor study prompts.
          </div>
        </div>

        {loading ? (
          <CardSkeleton count={3} />
        ) : recommendations.length > 0 ? (
          <div className="space-y-4">
            {recommendations.map((rec) => (
              <div
                key={rec.id}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs card-interactive transition-all"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <Badge variant="info">{rec.type}</Badge>
                    {rec.course && (
                      <span className="px-2.5 py-0.5 rounded-md bg-slate-100 font-bold text-slate-800 text-[10px] tracking-wider uppercase border border-slate-200">
                        {rec.course.code}
                      </span>
                    )}
                    <span className="text-slate-500 font-medium text-[11px]">⏱️ {rec.estimatedMinutes} mins target</span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900">{rec.title}</h3>
                  <p className="text-slate-600 leading-relaxed max-w-2xl text-[11px]">{rec.reason}</p>
                </div>

                <div className="shrink-0 flex items-center space-x-2">
                  <Link
                    href={rec.type === "QUIZ_RETEST" ? "/student/quizzes" : "/student/ai-tutor"}
                    className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg text-xs shadow-xs transition-all btn-press"
                  >
                    Start Action →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No Active Recommendations"
            description="You have completed all current remediation tasks."
          />
        )}
      </main>
    </div>
  );
}
