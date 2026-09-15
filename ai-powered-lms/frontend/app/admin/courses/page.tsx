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

  const loadCourses = async () => {
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
  };

  useEffect(() => {
    loadCourses();
  }, []);

  const handleDeleteCourse = async (courseId: string) => {
    if (!confirm("Are you sure you want to delete this course and all associated records?")) return;
    try {
      await apiRequest(`/courses/${courseId}`, { method: "DELETE" });
      loadCourses();
    } catch (err: any) {
      alert(err.message || "Failed to delete course");
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
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <Topbar title="University Course Catalog" subtitle="Academic Offerings & Faculty Assignments" />

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6 animate-fade-in">
        {/* Controls Bar */}
        <div className="bg-white border border-slate-200 rounded-xl p-4.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by code, course title, instructor..."
                className="bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs text-slate-900 w-80 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors shadow-2xs"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 font-medium">
              Showing <strong className="text-slate-900 font-mono">{filteredCourses.length}</strong> of <strong className="text-slate-900 font-mono">{courses.length}</strong> Offerings
            </span>
          </div>
        </div>

        {/* Courses Table */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Registered Department Courses ({courses.length})</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Active curriculum offerings across all semesters</p>
            </div>
            <Badge variant="default">Curriculum Archive</Badge>
          </div>

          {loading ? (
            <TableSkeleton rows={6} cols={8} />
          ) : filteredCourses.length > 0 ? (
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left academic-table">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px]">
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
                <tbody className="divide-y divide-slate-100">
                  {filteredCourses.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 font-bold text-slate-900">
                        <Badge variant="default">{c.code}</Badge>
                      </td>
                      <td className="py-3 font-semibold text-slate-900">{c.title}</td>
                      <td className="py-3 text-slate-600 font-medium">{c.credits} Credits</td>
                      <td className="py-3 text-slate-600">Semester {c.semester}</td>
                      <td className="py-3 text-slate-700">
                        {c.faculty?.name ? (
                          <span className="font-medium text-slate-900">{c.faculty.name}</span>
                        ) : (
                          <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[11px] border border-amber-200">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3 text-center">
                        <span className="font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                          {c._count?.enrollments || 0}
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <span className="font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                          {c._count?.materials || 0}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => handleDeleteCourse(c.id)}
                          className="px-3 py-1 text-xs text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-md font-semibold cursor-pointer transition-all btn-press"
                        >
                          Delete
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
