"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { apiRequest } from "@/lib/api";
import { Course } from "@/lib/types";
import Topbar from "@/components/layout/Topbar";
import CourseCard from "@/components/ui/CourseCard";
import EmptyState from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/SkeletonLoader";

export default function StudentCoursesPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewTab, setViewTab] = useState<"enrolled" | "all">("enrolled");

  useEffect(() => {
    async function loadCourses() {
      if (!user) return;
      try {
        setLoading(true);
        const enrolledRes = await apiRequest<Course[]>(`/students/${user.id}/courses`);
        if (enrolledRes.success) setCourses(enrolledRes.data);

        const allRes = await apiRequest<Course[]>("/courses");
        if (allRes.success) setAllCourses(allRes.data);
      } catch (err) {
        console.error("Failed to load courses:", err);
      } finally {
        setLoading(false);
      }
    }

    loadCourses();
  }, [user]);

  const handleEnroll = async (courseId: string) => {
    try {
      await apiRequest(`/courses/${courseId}/enroll`, {
        method: "POST",
      });
      // Refresh enrolled courses
      if (user) {
        const enrolledRes = await apiRequest<Course[]>(`/students/${user.id}/courses`);
        if (enrolledRes.success) setCourses(enrolledRes.data);
      }
    } catch (err: any) {
      alert(err.message || "Failed to enroll");
    }
  };

  const displayedCourses = viewTab === "enrolled" ? courses : allCourses;

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <Topbar title="Enrolled Courses" subtitle="Computer Engineering Curriculum • Semester 8" />

      <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex space-x-2">
            <button
              onClick={() => setViewTab("enrolled")}
              className={`btn-press px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                viewTab === "enrolled"
                  ? "bg-blue-700 text-white shadow-xs"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              My Enrolled Courses ({courses.length})
            </button>
            <button
              onClick={() => setViewTab("all")}
              className={`btn-press px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                viewTab === "all"
                  ? "bg-blue-700 text-white shadow-xs"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              All Department Courses ({allCourses.length})
            </button>
          </div>
        </div>

        {/* Courses Grid */}
        {loading ? (
          <CardSkeleton count={6} />
        ) : displayedCourses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
            {displayedCourses.map((course) => {
              const isEnrolled = courses.some((c) => c.id === course.id);
              return (
                <div key={course.id} className="flex flex-col">
                  <CourseCard course={course} baseHref="/student/courses" />
                  {viewTab === "all" && !isEnrolled && (
                    <button
                      onClick={() => handleEnroll(course.id)}
                      className="btn-press mt-2 w-full py-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-md transition-colors cursor-pointer shadow-2xs"
                    >
                      + Enroll in Course
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No Courses Found"
            description="You are not enrolled in any courses yet."
            actionText="Browse Available Courses"
            onAction={() => setViewTab("all")}
          />
        )}
      </main>
    </div>
  );
}
