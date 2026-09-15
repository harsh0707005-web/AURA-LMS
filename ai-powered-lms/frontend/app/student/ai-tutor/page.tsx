"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { apiRequest } from "@/lib/api";
import { Course } from "@/lib/types";
import Topbar from "@/components/layout/Topbar";
import AIChatBox from "@/components/tutor/AIChatBox";

export default function StudentAITutorPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    async function loadCourses() {
      if (!user) return;
      try {
        const res = await apiRequest<Course[]>(`/students/${user.id}/courses`);
        if (res.success && res.data) {
          setCourses(res.data);
        }
      } catch (err) {
        console.error("Failed to load courses:", err);
      }
    }

    loadCourses();
  }, [user]);

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <Topbar title="AI Course Academic Tutor" subtitle="Grounded Syllabus & Document Assistant" />

      <main className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-5 animate-fade-in">
        <div className="bg-white border border-slate-200 rounded-xl p-4.5 shadow-2xs flex items-start space-x-3.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0 text-base">
            🎓
          </div>
          <div className="text-xs text-slate-600 leading-relaxed">
            <span className="font-bold text-slate-900">Academic Context Engine:</span> The AI Tutor uses grounded Retrieval-Augmented Generation (RAG) referencing official Computer Engineering course lecture notes, syllabus modules, and textbook references to provide verified answers with page citations.
          </div>
        </div>

        <AIChatBox courses={courses} />
      </main>
    </div>
  );
}
