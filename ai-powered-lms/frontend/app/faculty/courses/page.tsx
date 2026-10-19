"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { apiRequest } from "@/lib/api";
import { Course } from "@/lib/types";
import Topbar from "@/components/layout/Topbar";
import EmptyState from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/SkeletonLoader";

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

  const loadCourses = React.useCallback(async () => {
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
  }, [user]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadCourses(), 0);
    return () => window.clearTimeout(timer);
  }, [loadCourses]);

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
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to create course");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-surface min-h-screen text-on-surface">
      <Topbar title="Course Management" subtitle="Instructional Offerings & Syllabi" />

      <main className="flex-1 p-6 sm:p-8 max-w-7xl mx-auto w-full space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-on-surface">Your Instructional Courses</h2>
            <p className="text-xs text-on-surface-variant">Manage syllabus content, materials, assignments, and test banks</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2.5 bg-primary hover:bg-primary-container text-on-primary font-semibold text-xs rounded-lg shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Create New Course</span>
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
                className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-5.5 shadow-xs flex flex-col justify-between text-xs space-y-4 hover:border-primary/40 hover:shadow-sm transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="px-2.5 py-1 rounded-md bg-surface-container-high text-primary font-bold border border-outline-variant/40 text-[10px] tracking-wider uppercase font-mono">
                      {c.code}
                    </span>
                    <span className="text-on-surface-variant font-medium text-[11px]">
                      Sem {c.semester} • {c.credits} Credits
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-on-surface mb-1.5 leading-snug">{c.title}</h3>
                  <p className="text-on-surface-variant line-clamp-2 leading-relaxed text-[11px]">
                    {c.description}
                  </p>
                </div>

                <div className="space-y-3 pt-3.5 border-t border-outline-variant/30">
                  <div className="flex items-center justify-between text-on-surface-variant text-[11px]">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px] text-outline">group</span>
                      {c._count?.enrollments || 0} Students
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px] text-outline">description</span>
                      {c._count?.materials || 0} Materials
                    </span>
                  </div>
                  <Link
                    href={`/faculty/courses/${c.id}`}
                    className="flex items-center justify-center gap-1 w-full py-2 bg-surface-container-low hover:bg-surface-container border border-outline-variant/40 text-on-surface font-semibold rounded-lg transition-all"
                  >
                    <span>Open Course Console</span>
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
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
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-2xl max-w-lg w-full p-6 shadow-xl text-xs space-y-4 animate-fade-in">
              <div className="flex items-center justify-between pb-3.5 border-b border-outline-variant/30">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">add_circle</span>
                  <h3 className="text-base font-bold text-on-surface">Create New Academic Course</h3>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-outline hover:text-on-surface font-bold text-xl cursor-pointer p-1"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              {errorMessage && (
                <div className="p-3 bg-error-container text-on-error-container rounded-xl font-medium">
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleCreateCourse} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-on-surface mb-1 font-mono text-[11px] uppercase tracking-wider">
                      Course Code
                    </label>
                    <input
                      type="text"
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="e.g. CS-405"
                      className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg p-2.5 text-on-surface placeholder:text-outline focus:outline-none focus:border-primary font-mono uppercase transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-on-surface mb-1 font-mono text-[11px] uppercase tracking-wider">
                      Credits
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={6}
                      value={credits}
                      onChange={(e) => setCredits(Number(e.target.value))}
                      className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg p-2.5 text-on-surface focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-on-surface mb-1 font-mono text-[11px] uppercase tracking-wider">
                    Target Semester
                  </label>
                  <select
                    value={semester}
                    onChange={(e) => setSemester(Number(e.target.value))}
                    className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg p-2.5 text-on-surface focus:outline-none focus:border-primary font-medium transition-colors"
                  >
                    <option value={1}>Semester I</option>
                    <option value={2}>Semester II</option>
                    <option value={3}>Semester III</option>
                    <option value={4}>Semester IV</option>
                    <option value={5}>Semester V</option>
                    <option value={6}>Semester VI</option>
                    <option value={7}>Semester VII</option>
                    <option value={8}>Semester VIII</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-on-surface mb-1 font-mono text-[11px] uppercase tracking-wider">
                    Course Title
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Compiler Design & Optimization"
                    className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg p-2.5 text-on-surface placeholder:text-outline focus:outline-none focus:border-primary transition-colors"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-on-surface mb-1 font-mono text-[11px] uppercase tracking-wider">
                    Description / Syllabus Overview
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Course objectives, prerequisites, and syllabus scope..."
                    className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg p-2.5 text-on-surface placeholder:text-outline focus:outline-none focus:border-primary transition-colors"
                  />
                </div>

                <div className="pt-3.5 border-t border-outline-variant/30 flex justify-end space-x-2.5">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container font-semibold cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-5 py-2.5 bg-primary hover:bg-primary-container text-on-primary font-semibold rounded-lg shadow-xs cursor-pointer transition-all disabled:opacity-50"
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
