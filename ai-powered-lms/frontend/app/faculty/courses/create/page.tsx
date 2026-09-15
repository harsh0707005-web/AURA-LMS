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
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to create course");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <Topbar
        title="Create New Academic Course"
        subtitle="Configure Syllabus Structure & Department Details"
      />

      <main className="p-6 sm:p-8 max-w-3xl mx-auto w-full space-y-6">
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs text-xs space-y-5">
          <div className="pb-3 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900">New Course Offering</h2>
            <p className="text-slate-500">Add course syllabus to the department catalog</p>
          </div>

          {errorMessage && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Course Code</label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. CS-405"
                  className="w-full bg-white border border-slate-300 rounded p-2 text-slate-900 focus:outline-none focus:border-blue-600 font-mono uppercase"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Semester</label>
                <select
                  value={semester}
                  onChange={(e) => setSemester(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded p-2 text-slate-900 focus:outline-none focus:border-blue-600 font-medium"
                >
                  <option value={5}>Semester V</option>
                  <option value={6}>Semester VI</option>
                  <option value={7}>Semester VII</option>
                  <option value={8}>Semester VIII</option>
                </select>
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
                  className="w-full bg-white border border-slate-300 rounded p-2 text-slate-900 focus:outline-none focus:border-blue-600"
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
                placeholder="e.g. Compiler Design & LLVM Optimizations"
                className="w-full bg-white border border-slate-300 rounded p-2 text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Course Description & Objectives</label>
              <textarea
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide overview of key syllabus topics, laboratory prerequisites, and outcomes..."
                className="w-full bg-white border border-slate-300 rounded p-2 text-slate-900 focus:outline-none focus:border-blue-600 resize-none"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-4 py-2 rounded text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded shadow-xs transition-colors cursor-pointer"
              >
                {loading ? "Publishing..." : "Create Course Offering →"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
