"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { apiRequest } from "@/lib/api";
import { Course, Material, MaterialProgress } from "@/lib/types";
import Topbar from "@/components/layout/Topbar";
import EmptyState from "@/components/ui/EmptyState";
import PDFViewerModal from "@/components/materials/PDFViewerModal";
import { TableSkeleton } from "@/components/ui/SkeletonLoader";

export default function StudentMaterialsPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("ALL");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingMaterial, setViewingMaterial] = useState<Material | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!user) return;
      try {
        setLoading(true);
        const coursesRes = await apiRequest<Course[]>(`/students/${user.id}/courses`);
        if (coursesRes.success && coursesRes.data) {
          setCourses(coursesRes.data);

          // Fetch materials for all courses
          const allMats: Material[] = [];
          for (const c of coursesRes.data) {
            const mRes = await apiRequest<Material[]>(`/courses/${c.id}/materials`);
            if (mRes.success && mRes.data) {
              const mapped = mRes.data.map((m) => ({
                ...m,
                course: { id: c.id, code: c.code, title: c.title },
              }));
              allMats.push(...mapped);
            }
          }
          setMaterials(allMats);
        }
      } catch (err) {
        console.error("Failed to load materials:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [user]);

  const handleProgressUpdate = (updated: MaterialProgress) => {
    setMaterials((prev) =>
      prev.map((m) => (m.id === updated.materialId ? { ...m, progress: updated } : m))
    );
    if (viewingMaterial && viewingMaterial.id === updated.materialId) {
      setViewingMaterial((prev) => (prev ? { ...prev, progress: updated } : null));
    }
  };

  const filteredMaterials =
    selectedCourseId === "ALL"
      ? materials
      : materials.filter((m) => m.courseId === selectedCourseId);

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <Topbar title="Course Materials & Lecture Notes" subtitle="Grounded Syllabus Repositories" />

      <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Filter Bar */}
        <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex items-center space-x-2 text-xs">
            <span className="font-semibold text-slate-700">Filter Course:</span>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-slate-800 font-medium focus:outline-none focus:border-blue-600 font-mono"
            >
              <option value="ALL">All Enrolled Courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}: {c.title}
                </option>
              ))}
            </select>
          </div>

          <span className="text-[11px] text-slate-500 font-medium font-mono">
            Showing {filteredMaterials.length} Documents
          </span>
        </div>

        {/* Materials List */}
        {loading ? (
          <TableSkeleton rows={5} cols={3} />
        ) : filteredMaterials.length > 0 ? (
          <div className="space-y-3 animate-fade-in">
            {filteredMaterials.map((m) => {
              const progress = m.progress;
              const percent = progress?.progressPercent || 0;
              const isCompleted = progress?.completed || percent >= 100;
              const currentPage = progress?.currentPage || 1;

              return (
                <div
                  key={m.id}
                  className="card-interactive p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs group"
                >
                  <div className="flex items-center space-x-3.5">
                    <div className="h-10 w-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-xl shrink-0">
                      📄
                    </div>
                    <div>
                      <div className="flex items-center space-x-2 mb-0.5">
                        <span className="font-bold text-slate-900 text-sm">{m.title}</span>
                        {m.course && (
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 text-[10px] font-bold border border-blue-200 uppercase">
                            {m.course.code}
                          </span>
                        )}
                        {isCompleted ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                            ✓ Completed
                          </span>
                        ) : percent > 0 ? (
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200">
                            In Progress ({percent}%)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium">
                            Not Started
                          </span>
                        )}
                      </div>
                      <div className="text-slate-500 flex items-center space-x-2">
                        <span>{m.unit}</span>
                        <span>•</span>
                        <span>{m.fileSize}</span>
                        <span>•</span>
                        <span>{m.ragChunksCount} Grounded RAG Chunks Indexed</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-end shrink-0">
                    {/* Mini Progress Bar */}
                    <div className="w-24 sm:w-28 space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                        <span>Progress</span>
                        <span className="font-bold font-mono">{percent}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-200">
                        <div
                          className={`h-full transition-all duration-300 ${
                            isCompleted ? "bg-emerald-600" : "bg-blue-600"
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    {/* Open / Resume Button */}
                    <button
                      onClick={() => setViewingMaterial(m)}
                      className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded text-xs shadow-xs transition-colors shrink-0 cursor-pointer"
                    >
                      {isCompleted
                        ? "Review Document →"
                        : percent > 0
                        ? `Continue (Page ${currentPage}) →`
                        : "Open Material →"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No Materials Available"
            description="No course materials match the selected filter."
          />
        )}
      </main>

      {/* PDF Reading Modal */}
      {viewingMaterial && (
        <PDFViewerModal
          material={viewingMaterial}
          onClose={() => setViewingMaterial(null)}
          onProgressUpdate={handleProgressUpdate}
        />
      )}
    </div>
  );
}

