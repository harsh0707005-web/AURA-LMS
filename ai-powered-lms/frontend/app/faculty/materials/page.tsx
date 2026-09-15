"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { apiRequest } from "@/lib/api";
import { Course, Material } from "@/lib/types";
import Topbar from "@/components/layout/Topbar";
import EmptyState from "@/components/ui/EmptyState";

import SkeletonLoader, { TableSkeleton } from "@/components/ui/SkeletonLoader";

export default function FacultyMaterialsPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  // Upload Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [unit, setUnit] = useState("Unit 1");
  const [fileSize, setFileSize] = useState("3.5 MB");
  const [uploading, setUploading] = useState(false);

  const loadData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const coursesRes = await apiRequest<Course[]>(`/faculty/${user.id}/courses`);
      if (coursesRes.success && coursesRes.data) {
        setCourses(coursesRes.data);
        if (coursesRes.data.length > 0 && !courseId) {
          setCourseId(coursesRes.data[0].id);
        }

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
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId || !title.trim()) return;

    setUploading(true);
    try {
      await apiRequest(`/courses/${courseId}/materials`, {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          unit: unit.trim(),
          fileSize,
          fileType: "pdf",
        }),
      });

      setIsModalOpen(false);
      setTitle("");
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to upload material");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (matId: string) => {
    if (!confirm("Are you sure you want to delete this lecture material?")) return;
    try {
      await apiRequest(`/materials/${matId}`, { method: "DELETE" });
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to delete");
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <Topbar title="Lecture Materials & RAG Repository" subtitle="Manage Course Documents & Notes" />

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6 animate-fade-in">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Uploaded Course Documents</h2>
            <p className="text-xs text-slate-500">Materials are automatically chunked for AI Tutor context grounding</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs rounded-lg shadow-xs transition-all cursor-pointer btn-press"
          >
            + Upload Lecture Notes
          </button>
        </div>

        {loading ? (
          <TableSkeleton rows={5} cols={3} />
        ) : materials.length > 0 ? (
          <div className="space-y-3">
            {materials.map((m) => (
              <div
                key={m.id}
                className="bg-white border border-slate-200 rounded-xl p-4.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs card-interactive transition-all"
              >
                <div className="flex items-center space-x-3.5">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 flex items-center justify-center shrink-0 text-lg">
                    📄
                  </div>
                  <div>
                    <div className="flex items-center space-x-2 mb-0.5">
                      <span className="font-bold text-slate-900 text-sm">{m.title}</span>
                      {m.course && (
                        <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-900 font-bold border border-blue-200 text-[10px] tracking-wider uppercase font-mono">
                          {m.course.code}
                        </span>
                      )}
                    </div>
                    <div className="text-slate-500 text-[11px]">
                      {m.unit} • {m.fileSize} • {m.ragChunksCount} Grounded RAG Chunks Indexed
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 self-end sm:self-center">
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="px-3.5 py-1.5 text-xs text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg font-semibold transition-all cursor-pointer btn-press"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No Documents Uploaded"
            description="You haven't uploaded any lecture materials yet."
            actionText="Upload Material"
            onAction={() => setIsModalOpen(true)}
          />
        )}

        {/* Upload Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl text-xs space-y-4">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900">Upload Course Material</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold text-xl cursor-pointer p-1">
                  ×
                </button>
              </div>

              <form onSubmit={handleUpload} className="space-y-3.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Course</label>
                  <select
                    value={courseId}
                    onChange={(e) => setCourseId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-blue-600 font-medium shadow-2xs transition-colors"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code}: {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Material / Document Title</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Unit 3: Distributed State Machines & Consensus"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Unit / Module</label>
                    <input
                      type="text"
                      required
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      placeholder="Unit 1"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">File Size</label>
                    <input
                      type="text"
                      value={fileSize}
                      onChange={(e) => setFileSize(e.target.value)}
                      placeholder="e.g. 3.2 MB"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs transition-colors"
                    />
                  </div>
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
                    disabled={uploading}
                    className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 active:scale-95 text-white font-semibold rounded-lg shadow-xs cursor-pointer transition-all btn-press"
                  >
                    {uploading ? "Indexing..." : "Upload & Process Material"}
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
