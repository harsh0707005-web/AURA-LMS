"use client";

import React, { useState, useEffect } from "react";
import { apiRequest } from "@/lib/api";
import { Course } from "@/lib/types";
import Topbar from "@/components/layout/Topbar";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/SkeletonLoader";

export default function AdminCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const loadCourses = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiRequest<Course[]>("/courses");
      if (res.success && res.data) {
        setCourses(res.data);
      }
    } catch (err) {
      console.error("Failed to load courses:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadCourses(), 0);
    return () => window.clearTimeout(timer);
  }, [loadCourses]);

  const handleDeleteCourse = async (courseId: string) => {
    if (!confirm("Are you sure you want to permanently delete this course and all associated records?")) return;
    try {
      await apiRequest(`/courses/${courseId}`, { method: "DELETE" });
      loadCourses();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete course");
    }
  };

  const filteredCourses = courses.filter((c) => {
    const q = searchTerm.toLowerCase();
    return (
      c.code?.toLowerCase().includes(q) ||
      c.title?.toLowerCase().includes(q) ||
      c.faculty?.name?.toLowerCase().includes(q) ||
      c.department?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 flex flex-col bg-surface min-h-screen text-on-surface">
      <Topbar title="University Course Catalog" subtitle="Academic Offerings & Faculty Assignments" />

      <main className="flex-1 p-6 sm:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Controls Bar */}
        <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-4.5 sm:p-5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="relative w-80">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                search
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search code, course title, instructor..."
                className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg pl-9 pr-8 py-2 text-xs text-on-surface placeholder:text-outline focus:outline-none focus:border-primary transition-colors"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface text-xs font-bold"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-on-surface-variant font-medium">
              Showing <strong className="text-on-surface font-mono">{filteredCourses.length}</strong> of <strong className="text-on-surface font-mono">{courses.length}</strong> Offerings
            </span>
          </div>
        </div>

        {/* Courses Table */}
        <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3.5 border-b border-outline-variant/30">
            <div>
              <h3 className="text-sm font-bold text-on-surface">Registered Department Courses ({courses.length})</h3>
              <p className="text-[11px] text-on-surface-variant mt-0.5">Active curriculum offerings across all semesters</p>
            </div>
            <Badge variant="default">Curriculum Archive</Badge>
          </div>

          {loading ? (
            <TableSkeleton rows={6} cols={8} />
          ) : filteredCourses.length > 0 ? (
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-outline-variant/30 text-outline uppercase text-[10px] tracking-wider font-mono">
                    <th className="pb-2.5 font-bold">Code</th>
                    <th className="pb-2.5 font-bold">Course Title</th>
                    <th className="pb-2.5 font-bold">Credits</th>
                    <th className="pb-2.5 font-bold">Semester</th>
                    <th className="pb-2.5 font-bold">Instructor</th>
                    <th className="pb-2.5 font-bold text-center">Enrolled</th>
                    <th className="pb-2.5 font-bold text-center">Materials</th>
                    <th className="pb-2.5 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {filteredCourses.map((c) => (
                    <tr key={c.id} className="hover:bg-surface-container-low/70 transition-colors">
                      <td className="py-3 font-bold text-primary">
                        <span className="px-2.5 py-0.5 rounded-md bg-surface-container-high text-primary font-bold border border-outline-variant/40 text-[10px] tracking-wider uppercase font-mono">
                          {c.code}
                        </span>
                      </td>
                      <td className="py-3 font-semibold text-on-surface">{c.title}</td>
                      <td className="py-3 text-on-surface-variant font-mono text-[11px]">{c.credits} Credits</td>
                      <td className="py-3 text-on-surface-variant font-mono text-[11px]">Semester {c.semester}</td>
                      <td className="py-3 text-on-surface">
                        {c.faculty?.name ? (
                          <span className="font-medium text-on-surface">{c.faculty.name}</span>
                        ) : (
                          <span className="text-outline italic">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3 text-center">
                        <span className="font-mono font-bold text-primary bg-surface-container px-2.5 py-0.5 rounded-full text-[11px]">
                          {c._count?.enrollments || 0}
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <span className="font-mono font-bold text-on-surface-variant bg-surface-container px-2.5 py-0.5 rounded-full text-[11px]">
                          {c._count?.materials || 0}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => handleDeleteCourse(c.id)}
                          className="px-2.5 py-1 text-xs text-error hover:bg-error-container/40 border border-error/30 rounded-lg font-semibold cursor-pointer transition-all inline-flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[13px]">delete</span>
                          <span>Delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No Courses Found" description="No academic courses match your search criteria." />
          )}
        </div>
      </main>
    </div>
  );
}
