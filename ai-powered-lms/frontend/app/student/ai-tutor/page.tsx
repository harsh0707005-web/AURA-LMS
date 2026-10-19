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
    <div className="flex-1 flex flex-col bg-surface min-h-screen text-on-surface">
      <Topbar
        title="AI Course Academic Tutor"
        subtitle="Grounded Syllabus & Document Assistant"
      />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 animate-fade-in">
        <AIChatBox courses={courses} mode="full" />
      </main>
    </div>
  );
}
