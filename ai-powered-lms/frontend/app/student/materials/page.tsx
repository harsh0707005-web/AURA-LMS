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
    <div className="flex-1 flex flex-col bg-surface min-h-screen text-on-surface">
      <Topbar title="Course Materials & Lecture Notes" subtitle="Grounded Syllabus Repositories" />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 animate-fade-in">
        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-container-lowest border border-surface-container-high rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-on-surface">Filter Course:</span>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="bg-surface-container-low border border-surface-container-high rounded-xl px-3 py-1.5 text-on-surface font-label-sm text-[11px] focus:outline-hidden focus:ring-1 focus:ring-primary"
              aria-label="Filter by course"
            >
              <option value="ALL">All Enrolled Courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}: {c.title}
                </option>
              ))}
            </select>
          </div>

          <span className="font-label-sm text-[11px] text-outline">
            Showing {filteredMaterials.length} Documents
          </span>
        </div>

        {/* Materials List */}
        {loading ? (
          <TableSkeleton rows={5} cols={3} />
        ) : filteredMaterials.length > 0 ? (
          <div className="space-y-3">
            {filteredMaterials.map((m) => {
              const progress = m.progress;
              const percent = progress?.progressPercent || 0;
              const isCompleted = progress?.completed || percent >= 100;
              const currentPage = progress?.currentPage || 1;

              return (
                <div
                  key={m.id}
                  className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs shadow-sm hover:border-outline-variant transition-all"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-surface-container-low border border-surface-container-high flex items-center justify-center text-primary shrink-0 shadow-2xs">
                      <span className="material-symbols-outlined text-[24px]">description</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-headline-sm font-bold text-on-surface text-sm truncate">
                          {m.title}
                        </span>
                        {m.course && (
                          <span className="px-2 py-0.5 rounded-md bg-primary-fixed text-primary font-label-sm text-[10px] font-bold border border-primary/20 uppercase">
                            {m.course.code}
                          </span>
                        )}
                        {isCompleted ? (
                          <span className="px-2 py-0.5 rounded-md bg-[#ecfdf5] text-[#065f46] font-label-sm text-[10px] font-bold border border-[#a7f3d0]">
                            ✓ Completed
                          </span>
                        ) : percent > 0 ? (
                          <span className="px-2 py-0.5 rounded-md bg-primary-fixed text-primary font-label-sm text-[10px] font-bold border border-primary/20">
                            In Progress ({percent}%)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-surface-container text-on-surface-variant font-label-sm text-[10px]">
                            Not Started
                          </span>
                        )}
                      </div>
                      <div className="font-label-sm text-[11px] text-outline flex flex-wrap items-center gap-2">
                        <span>{m.unit}</span>
                        <span>•</span>
                        <span>{m.fileSize}</span>
                        <span>•</span>
                        <span>{m.ragChunksCount} Grounded RAG Chunks</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-surface-container-high">
                    {/* Mini Progress Bar */}
                    <div className="w-24 sm:w-28 space-y-1">
                      <div className="flex justify-between font-label-sm text-[10px] text-outline">
                        <span>Progress</span>
                        <span className="font-bold text-on-surface">{percent}%</span>
                      </div>
                      <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary-container transition-all duration-300"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setViewingMaterial(m)}
                      className="px-4 py-2 bg-primary-container hover:opacity-90 text-on-primary font-semibold rounded-xl text-xs shadow-2xs transition-all shrink-0 cursor-pointer"
                    >
                      {isCompleted
                        ? "Review Document →"
                        : percent > 0
                        ? `Continue (p. ${currentPage}) →`
                        : "Open Material →"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No Documents Found"
            description="No lecture materials match your current course selection."
          />
        )}
      </main>

      {/* Embedded Protected PDF Modal */}
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
