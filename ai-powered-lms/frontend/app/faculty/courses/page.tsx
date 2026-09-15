"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { apiRequest } from "@/lib/api";
import { Course } from "@/lib/types";
import Topbar from "@/components/layout/Topbar";
import EmptyState from "@/components/ui/EmptyState";

import SkeletonLoader, { CardSkeleton } from "@/components/ui/SkeletonLoader";

export default function FacultyCoursesPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  // New Course Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [credits, setCredits] = useState(4);
  const [semester, setSemester] = useState(8);
  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadCourses = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await apiRequest<Course[]>(`/faculty/${user.id}/courses`);
      if (res.success && res.data) {
        setCourses(res.data);
      }
    } catch (err) {
      console.error("Failed to load faculty courses:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, [user]);

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setErrorMessage("");

    try {
      await apiRequest("/courses", {
        method: "POST",
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          title: title.trim(),
          description: description.trim(),
          credits: Number(credits),
          semester: Number(semester),
        }),
      });

      setIsModalOpen(false);
      setCode("");
      setTitle("");
      setDescription("");
      loadCourses();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to create course");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <Topbar title="Course Management" subtitle="Instructional Offerings & Syllabi" />

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6 animate-fade-in">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Your Instructional Courses</h2>
            <p className="text-xs text-slate-500">Manage syllabus content, materials, assignments, and test banks</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs rounded-lg shadow-xs transition-all cursor-pointer btn-press"
          >
            + Create New Course
          </button>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <CardSkeleton count={6} />
          </div>
        ) : courses.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((c) => (
              <div
                key={c.id}
                className="bg-white border border-slate-200 rounded-xl p-5.5 shadow-xs flex flex-col justify-between text-xs space-y-3.5 card-interactive"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-900 font-bold border border-blue-200 text-[10px] tracking-wider uppercase font-mono">
                      {c.code}
                    </span>
                    <span className="text-slate-500 font-medium text-[11px]">Sem {c.semester} • {c.credits} Credits</span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 mb-1.5 leading-snug">{c.title}</h3>
                  <p className="text-slate-600 line-clamp-2 leading-relaxed text-[11px]">{c.description}</p>
                </div>

                <div className="space-y-2.5 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between text-slate-500 text-[11px]">
                    <span>👥 {c._count?.enrollments || 0} Students</span>
                    <span>📄 {c._count?.materials || 0} Materials</span>
                  </div>
                  <Link
                    href={`/faculty/courses/${c.id}`}
                    className="block text-center w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg transition-all btn-press"
                  >
                    Open Course Console →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No Courses Found"
            description="You have not created any courses yet."
            actionText="Create Course"
            onAction={() => setIsModalOpen(true)}
          />
        )}

        {/* Create Course Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl text-xs space-y-4">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900">Create New Academic Course</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold text-xl cursor-pointer p-1">
                  ×
                </button>
              </div>

              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl font-medium animate-fade-in">
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleCreateCourse} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Course Code</label>
                    <input
                      type="text"
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="e.g. CS-405"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs font-mono uppercase transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Credits</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={6}
                      value={credits}
                      onChange={(e) => setCredits(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Course Title</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Compiler Design & Optimization"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs transition-colors"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Description / Syllabus Overview</label>
                  <textarea
                    rows={3}
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Course objectives, prerequisites, and syllabus scope..."
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs transition-colors"
                  />
                </div>

                <div className="pt-3.5 border-t border-slate-100 flex justify-end space-x-2.5">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 active:scale-95 text-white font-semibold rounded-lg shadow-xs cursor-pointer transition-all btn-press"
                  >
                    {creating ? "Creating..." : "Save & Register Course"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
