"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import Topbar from "@/components/layout/Topbar";

export default function FacultyCreateCoursePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [semester, setSemester] = useState(8);
  const [credits, setCredits] = useState(4);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    try {
      await apiRequest("/courses", {
        method: "POST",
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          title: title.trim(),
          description: description.trim(),
          semester: Number(semester),
          credits: Number(credits),
        }),
      });

      router.push("/faculty/courses");
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to create course");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-surface min-h-screen text-on-surface">
      <Topbar
        title="Create New Academic Course"
        subtitle="Configure Syllabus Structure & Department Details"
      />

      <main className="p-6 sm:p-8 max-w-3xl mx-auto w-full space-y-6">
        <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-6 sm:p-7 shadow-xs text-xs space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-outline-variant/30">
            <div className="w-10 h-10 rounded-xl bg-surface-container-high text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">post_add</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-on-surface">New Course Offering</h2>
              <p className="text-on-surface-variant">Add course syllabus to the department catalog</p>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 bg-error-container text-on-error-container rounded-xl font-medium">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                  className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg p-2.5 text-on-surface focus:outline-none focus:border-primary font-mono uppercase transition-colors"
                />
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
                Course Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Compiler Design & LLVM Optimizations"
                className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg p-2.5 text-on-surface focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="block font-semibold text-on-surface mb-1 font-mono text-[11px] uppercase tracking-wider">
                Course Description & Objectives
              </label>
              <textarea
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide overview of key syllabus topics, laboratory prerequisites, and learning outcomes..."
                className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg p-2.5 text-on-surface focus:outline-none focus:border-primary resize-none transition-colors"
              />
            </div>

            <div className="pt-4 border-t border-outline-variant/30 flex justify-end space-x-2.5">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-4 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 bg-primary hover:bg-primary-container text-on-primary font-semibold rounded-lg shadow-xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <span>{loading ? "Publishing..." : "Create Course Offering"}</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
