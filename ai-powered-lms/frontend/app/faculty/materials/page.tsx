"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { apiRequest } from "@/lib/api";
import { Course, Material } from "@/lib/types";
import Topbar from "@/components/layout/Topbar";
import EmptyState from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/SkeletonLoader";

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
  const [fileSize, setFileSize] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadData = useCallback(async () => {
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
  }, [courseId, user]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] ?? null;
    setFile(selectedFile);
    if (selectedFile) {
      const mb = (selectedFile.size / (1024 * 1024)).toFixed(1);
      setFileSize(`${mb} MB`);
      if (!title.trim()) {
        const cleanName = selectedFile.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        setTitle(cleanName);
      }
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!courseId) {
      setErrorMessage("Please select a target course.");
      return;
    }
    if (!title.trim()) {
      setErrorMessage("Please enter a material title.");
      return;
    }
    if (!file) {
      setErrorMessage("Please select a PDF document to upload.");
      return;
    }

    // Enforce 25 MB limit
    if (file.size > 25 * 1024 * 1024) {
      setErrorMessage("File exceeds maximum allowed size of 25 MB.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("unit", unit.trim());
      formData.append("fileSize", fileSize || `${(file.size / (1024 * 1024)).toFixed(1)} MB`);
      formData.append("fileType", "pdf");
      formData.append("file", file, file.name);

      // Multipart upload: API client does not set Content-Type header when body is FormData
      await apiRequest(`/courses/${courseId}/materials`, {
        method: "POST",
        body: formData,
      });

      setIsModalOpen(false);
      setTitle("");
      setFile(null);
      setFileSize("");
      await loadData();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to upload material");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (matId: string) => {
    if (!confirm("Are you sure you want to delete this lecture material and its indexed chunks?")) return;
    try {
      await apiRequest(`/materials/${matId}`, { method: "DELETE" });
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-surface min-h-screen text-on-surface">
      <Topbar title="Lecture Materials & RAG Repository" subtitle="Course Knowledge Base & Document Grounding" />

      <main className="flex-1 p-6 sm:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Hub Banner */}
        <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/40 p-6 sm:p-7 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="material-symbols-outlined text-primary text-[22px]">auto_stories</span>
              <h2 className="text-lg font-bold text-on-surface">Course Knowledge Base</h2>
              <span className="px-2 py-0.5 rounded bg-surface-container font-mono text-[11px] font-bold text-primary">
                {materials.length} Documents
              </span>
            </div>
            <p className="text-xs text-on-surface-variant max-w-2xl leading-relaxed">
              Uploaded PDF lecture notes and syllabi are chunked and vectorized for course-grounded AI tutoring and accurate question generation.
            </p>
          </div>

          <button
            onClick={() => {
              setErrorMessage("");
              setIsModalOpen(true);
            }}
            className="px-4 py-2.5 bg-primary hover:bg-primary-container text-on-primary font-semibold text-xs rounded-lg shadow-xs transition-all cursor-pointer flex items-center gap-2 shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">upload_file</span>
            <span>+ Upload Lecture Notes</span>
          </button>
        </div>

        {/* Upload Dropzone Preview (Click to open modal) */}
        <div
          onClick={() => {
            setErrorMessage("");
            setIsModalOpen(true);
          }}
          className="rounded-2xl border-2 border-dashed border-outline-variant/60 hover:border-primary/60 bg-surface-container-low/40 hover:bg-surface-container-low p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2"
        >
          <div className="w-12 h-12 rounded-full bg-surface-container-lowest text-primary shadow-xs flex items-center justify-center mb-1">
            <span className="material-symbols-outlined text-[26px]">cloud_upload</span>
          </div>
          <p className="text-sm font-bold text-on-surface">
            Drop course lecture notes, syllabus, or reading decks here to index
          </p>
          <p className="text-xs text-outline max-w-md">
            Supports PDF files up to 25 MB. Automatic text extraction, semantic chunking, and embedding generation will run upon upload.
          </p>
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary">
            <span>Browse Computer Files</span>
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </span>
        </div>

        {/* Materials Table */}
        <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3.5 border-b border-outline-variant/30">
            <h3 className="text-sm font-bold text-on-surface">Grounded Documents Repository</h3>
            <span className="font-mono text-[11px] text-outline font-semibold uppercase">
              Indexed Corpus
            </span>
          </div>

          {loading ? (
            <TableSkeleton rows={5} cols={5} />
          ) : materials.length > 0 ? (
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-outline-variant/30 text-outline uppercase text-[10px] tracking-wider font-mono">
                    <th className="pb-2.5 font-bold">Document Title</th>
                    <th className="pb-2.5 font-bold">Course</th>
                    <th className="pb-2.5 font-bold">Module / Unit</th>
                    <th className="pb-2.5 font-bold">File Size</th>
                    <th className="pb-2.5 font-bold">Indexing Status</th>
                    <th className="pb-2.5 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {materials.map((m) => (
                    <tr key={m.id} className="hover:bg-surface-container-low/70 transition-colors">
                      <td className="py-3.5 font-bold text-on-surface">
                        <div className="flex items-center gap-2.5">
                          <span className="material-symbols-outlined text-error text-[20px]">picture_as_pdf</span>
                          <div>
                            <span className="text-on-surface font-semibold text-xs">{m.title}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5">
                        {m.course ? (
                          <span className="px-2 py-0.5 rounded-md bg-surface-container-high text-primary font-bold border border-outline-variant/40 text-[10px] tracking-wider uppercase font-mono">
                            {m.course.code}
                          </span>
                        ) : (
                          <span className="text-outline font-mono text-[11px]">N/A</span>
                        )}
                      </td>
                      <td className="py-3.5 text-on-surface-variant font-medium">{m.unit}</td>
                      <td className="py-3.5 text-on-surface-variant font-mono text-[11px]">{m.fileSize}</td>
                      <td className="py-3.5">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary-container px-2.5 py-0.5 font-mono text-[10px] font-semibold text-on-secondary-container">
                          <span className="h-1.5 w-1.5 rounded-full bg-secondary"></span>
                          <span>{m.ragChunksCount} Grounded Chunks</span>
                        </span>
                      </td>
                      <td className="py-3.5 text-right">
                        <button
                          onClick={() => handleDelete(m.id)}
                          className="px-2.5 py-1 text-xs text-error hover:bg-error-container/40 border border-error/30 rounded-lg font-semibold transition-all cursor-pointer inline-flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">delete</span>
                          <span>Delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No Documents Uploaded"
              description="You haven't uploaded any lecture materials or course notes yet."
              actionText="Upload Material"
              onAction={() => setIsModalOpen(true)}
            />
          )}
        </div>

        {/* Upload Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-2xl max-w-lg w-full p-6 shadow-xl text-xs space-y-4 animate-fade-in">
              <div className="flex items-center justify-between pb-3.5 border-b border-outline-variant/30">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">upload_file</span>
                  <h3 className="text-base font-bold text-on-surface">Upload Course Material</h3>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  disabled={uploading}
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

              <form onSubmit={handleUpload} className="space-y-4">
                <div>
                  <label className="block font-semibold text-on-surface mb-1 font-mono text-[11px] uppercase tracking-wider">
                    Target Course
                  </label>
                  <select
                    value={courseId}
                    onChange={(e) => setCourseId(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg p-2.5 text-on-surface focus:outline-none focus:border-primary font-medium transition-colors"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code}: {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-on-surface mb-1 font-mono text-[11px] uppercase tracking-wider">
                    Material / Document Title
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Unit 3: Distributed State Machines & Consensus"
                    className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg p-2.5 text-on-surface placeholder:text-outline focus:outline-none focus:border-primary transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-on-surface mb-1 font-mono text-[11px] uppercase tracking-wider">
                      Unit / Module
                    </label>
                    <input
                      type="text"
                      required
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      placeholder="Unit 1"
                      className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg p-2.5 text-on-surface placeholder:text-outline focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-on-surface mb-1 font-mono text-[11px] uppercase tracking-wider">
                      Estimated File Size
                    </label>
                    <input
                      type="text"
                      value={fileSize}
                      onChange={(e) => setFileSize(e.target.value)}
                      placeholder="e.g. 3.2 MB"
                      className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg p-2.5 text-on-surface placeholder:text-outline focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-on-surface mb-1 font-mono text-[11px] uppercase tracking-wider" htmlFor="material-file">
                    PDF Document File
                  </label>
                  <input
                    id="material-file"
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={handleFileChange}
                    className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg p-2.5 text-on-surface file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-on-primary file:cursor-pointer"
                  />
                  <p className="mt-1 text-[11px] text-on-surface-variant">
                    PDF only, up to 25 MB. Text extraction and vector chunking occur synchronously.
                  </p>
                </div>

                <div className="pt-4 border-t border-outline-variant/30 flex justify-end space-x-2.5">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    disabled={uploading}
                    className="px-4 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container font-semibold cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="px-5 py-2.5 bg-primary hover:bg-primary-container text-on-primary font-semibold rounded-lg shadow-xs cursor-pointer transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {uploading && (
                      <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    )}
                    <span>{uploading ? "Chunking & Vectorizing..." : "Upload & Index PDF"}</span>
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
