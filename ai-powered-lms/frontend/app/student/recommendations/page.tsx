"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { apiRequest } from "@/lib/api";
import { Recommendation } from "@/lib/types";
import Topbar from "@/components/layout/Topbar";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/SkeletonLoader";

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
    <div className="flex-1 flex flex-col bg-surface min-h-screen text-on-surface">
      <Topbar
        title="Personalized Study Recommendations"
        subtitle="Automated Remediations from Assessment Diagnostics"
      />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full space-y-6 animate-fade-in">
        {/* Academic Rationale Banner */}
        <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-4.5 text-xs text-on-surface shadow-sm flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">lightbulb</span>
          </div>
          <div>
            <strong className="block font-headline-sm font-bold text-on-surface mb-0.5">
              How Recommendations Work:
            </strong>
            AURA LMS analyzes incorrect quiz answers and module mastery levels to generate targeted review tasks, practice retests, and AI Tutor study prompts.
          </div>
        </div>

        {loading ? (
          <CardSkeleton count={3} />
        ) : recommendations.length > 0 ? (
          <div className="space-y-4">
            {recommendations.map((rec) => (
              <div
                key={rec.id}
                className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs hover:border-outline-variant transition-all"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="info">{rec.type}</Badge>
                    {rec.course && (
                      <span className="px-2.5 py-0.5 rounded-md bg-surface-container font-bold text-on-surface font-label-sm text-[10px] tracking-wider uppercase border border-surface-container-high">
                        {rec.course.code}
                      </span>
                    )}
                    <span className="font-label-sm text-outline text-[11px]">
                      ⏱️ {rec.estimatedMinutes} mins target
                    </span>
                  </div>

                  <h3 className="font-headline-sm text-sm font-bold text-on-surface leading-snug">
                    {rec.title}
                  </h3>
                  <p className="font-body-sm text-on-surface-variant leading-relaxed max-w-2xl text-[11px]">
                    {rec.reason}
                  </p>
                </div>

                <div className="shrink-0 flex items-center">
                  <Link
                    href={rec.type === "QUIZ_RETEST" ? "/student/quizzes" : "/student/ai-tutor"}
                    className="px-4 py-2 bg-primary-container hover:opacity-90 text-on-primary font-semibold rounded-xl text-xs shadow-xs transition-opacity"
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
            description="You have completed all current remediation tasks. Great job maintaining syllabus mastery!"
            actionText="Explore Topics in AI Tutor"
            actionHref="/student/ai-tutor"
          />
        )}
      </main>
    </div>
  );
}
