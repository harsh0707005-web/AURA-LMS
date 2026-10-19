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
        if (enrolledRes.success && enrolledRes.data) setCourses(enrolledRes.data);

        const allRes = await apiRequest<Course[]>("/courses");
        if (allRes.success && allRes.data) setAllCourses(allRes.data);
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
        if (enrolledRes.success && enrolledRes.data) setCourses(enrolledRes.data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to enroll";
      alert(msg);
    }
  };

  const displayedCourses = viewTab === "enrolled" ? courses : allCourses;

  return (
    <div className="flex-1 flex flex-col bg-surface min-h-screen text-on-surface">
      <Topbar title="Enrolled Courses" subtitle="Computer Engineering Curriculum • Semester 8" />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 animate-fade-in">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-surface-container-high pb-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setViewTab("enrolled")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow-2xs ${
                viewTab === "enrolled"
                  ? "bg-primary-container text-on-primary shadow-xs"
                  : "bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container hover:text-on-surface border border-surface-container-high"
              }`}
            >
              My Enrolled Courses ({courses.length})
            </button>
            <button
              type="button"
              onClick={() => setViewTab("all")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow-2xs ${
                viewTab === "all"
                  ? "bg-primary-container text-on-primary shadow-xs"
                  : "bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container hover:text-on-surface border border-surface-container-high"
              }`}
            >
              All Department Courses ({allCourses.length})
            </button>
          </div>
        </div>

        {/* Courses Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <CardSkeleton count={6} />
          </div>
        ) : displayedCourses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedCourses.map((course) => {
              const isEnrolled = courses.some((c) => c.id === course.id);
              return (
                <div key={course.id} className="flex flex-col">
                  <CourseCard course={course} baseHref="/student/courses" />
                  {viewTab === "all" && !isEnrolled && (
                    <button
                      type="button"
                      onClick={() => handleEnroll(course.id)}
                      className="mt-2.5 w-full py-2 text-xs font-semibold bg-secondary text-on-secondary hover:opacity-90 rounded-xl transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
                      <span>Enroll in Course</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title={viewTab === "enrolled" ? "No Courses Enrolled" : "No Courses Available"}
            description={
              viewTab === "enrolled"
                ? "You have not enrolled in any courses yet. Browse all department courses to enroll."
                : "No course offerings were found in the institutional directory."
            }
            actionText={viewTab === "enrolled" ? "Browse Department Courses" : undefined}
            onAction={viewTab === "enrolled" ? () => setViewTab("all") : undefined}
          />
        )}
      </main>
    </div>
  );
}
