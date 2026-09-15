"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import { Course, Material, Assignment, Quiz, MaterialProgress } from "@/lib/types";
import Topbar from "@/components/layout/Topbar";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import AIChatBox from "@/components/tutor/AIChatBox";
import PDFViewerModal from "@/components/materials/PDFViewerModal";

import SkeletonLoader, { CardSkeleton } from "@/components/ui/SkeletonLoader";

export default function StudentCourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const courseId = resolvedParams.id;

  const [course, setCourse] = useState<Course | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "materials" | "assignments" | "quizzes" | "tutor">("overview");
  const [loading, setLoading] = useState(true);
  const [viewingMaterial, setViewingMaterial] = useState<Material | null>(null);

  useEffect(() => {
    async function loadCourseDetail() {
      try {
        setLoading(true);
        const res = await apiRequest<Course>(`/courses/${courseId}`);
        if (res.success && res.data) {
          setCourse(res.data);
        }
      } catch (err) {
        console.error("Failed to load course details:", err);
      } finally {
        setLoading(false);
      }
    }

    loadCourseDetail();
  }, [courseId]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
        <Topbar title="Course Workspace" />
        <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs animate-pulse">
            <div className="h-6 w-1/3 bg-slate-200 rounded mb-3"></div>
            <div className="h-4 w-2/3 bg-slate-100 rounded"></div>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <CardSkeleton count={2} />
          </div>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
        <Topbar title="Course Not Found" />
        <div className="p-12 text-center">
          <EmptyState
            title="Course Not Found"
            description="The requested course does not exist or has been removed."
            actionText="Back to Courses"
            actionHref="/student/courses"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <Topbar title={`${course.code}: ${course.title}`} subtitle={`Department of ${course.department}`} />

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6 animate-fade-in">
        {/* Course Header Banner */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center space-x-2.5">
              <span className="text-xs font-bold bg-blue-50 text-blue-900 border border-blue-200 px-2.5 py-1 rounded-md uppercase tracking-wider">
                {course.code}
              </span>
              <span className="text-xs font-medium text-slate-500">
                {course.credits} Credits • Semester {course.semester} • {course.totalModules} Units
              </span>
            </div>
            {course.faculty && (
              <div className="text-xs text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/60">
                Instructor: <span className="font-semibold text-slate-900">{course.faculty.name}</span> ({course.faculty.email})
              </div>
            )}
          </div>

          <h2 className="text-xl font-bold text-slate-900 mb-2">{course.title}</h2>
          <p className="text-xs text-slate-600 leading-relaxed max-w-4xl">{course.description}</p>
        </div>

        {/* Course Tabs */}
        <div className="flex border-b border-slate-200 space-x-2">
          {[
            { key: "overview", label: "Overview" },
            { key: "materials", label: `Materials (${course.materials?.length || 0})` },
            { key: "assignments", label: `Assignments (${course.assignments?.length || 0})` },
            { key: "quizzes", label: `Quizzes (${course.quizzes?.length || 0})` },
            { key: "tutor", label: "AI Course Tutor" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`py-2.5 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer btn-press ${
                activeTab === tab.key
                  ? "border-blue-700 text-blue-800 bg-white rounded-t-lg shadow-2xs"
                  : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60 rounded-t-lg"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Overview */}
        {activeTab === "overview" && (
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                <h3 className="text-sm font-bold text-slate-900 mb-3">Syllabus Breakdown</h3>
                <div className="space-y-3 text-xs text-slate-700">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <strong>Unit 1:</strong> System Architecture, Core Invariants & Inter-Process Comm
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <strong>Unit 2:</strong> Concurrency Protocols, State Machine Replication & Consensus
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <strong>Unit 3:</strong> Fault Isolation, Verification Assertions & Evaluation
                  </div>
                </div>
              </div>

              {/* Quick Assignments & Quizzes */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                <h3 className="text-sm font-bold text-slate-900 mb-3">Assessments & Deadlines</h3>
                {course.assignments && course.assignments.length > 0 ? (
                  <div className="space-y-2">
                    {course.assignments.map((a) => (
                      <div key={a.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs card-interactive">
                        <span className="font-semibold text-slate-900">{a.title}</span>
                        <span className="text-slate-500">Due: {new Date(a.dueDate).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">No active assignments posted.</div>
                )}
              </div>
            </div>

            <div>
              <AIChatBox courseId={course.id} courses={[course]} />
            </div>
          </div>
        )}

        {/* Tab 2: Materials */}
        {activeTab === "materials" && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900">Lecture Materials & References</h3>
              <span className="text-xs text-slate-500">Syllabus Grounded Files</span>
            </div>

            {course.materials && course.materials.length > 0 ? (
              <div className="space-y-3">
                {course.materials.map((m) => {
                  const progress = m.progress;
                  const percent = progress?.progressPercent || 0;
                  const isCompleted = progress?.completed || percent >= 100;
                  const currentPage = progress?.currentPage || 1;

                  return (
                    <div
                      key={m.id}
                      className="p-4 border border-slate-200 rounded-xl bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs shadow-2xs card-interactive transition-all"
                    >
                      <div className="flex items-center space-x-3.5">
                        <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-lg shrink-0">
                          📄
                        </div>
                        <div>
                          <div className="flex items-center space-x-2 mb-0.5">
                            <span className="font-bold text-slate-900">{m.title}</span>
                            {isCompleted ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                                ✓ Completed
                              </span>
                            ) : percent > 0 ? (
                              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200">
                                In Progress ({percent}%)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium">
                                Not Started
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {m.unit} • {m.fileSize} • {m.ragChunksCount} Grounded RAG Chunks Indexed
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-end shrink-0">
                        {/* Mini Progress Bar */}
                        <div className="w-24 space-y-1">
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

                        <button
                          onClick={() => setViewingMaterial({ ...m, course: { id: course.id, code: course.code, title: course.title } })}
                          className="px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg text-xs shadow-2xs transition-all shrink-0 cursor-pointer btn-press"
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
              <EmptyState title="No Materials Uploaded" description="The instructor has not uploaded lecture notes for this course yet." />
            )}
          </div>
        )}

        {/* Tab 3: Assignments */}
        {activeTab === "assignments" && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100 mb-4">
              Course Assignments & Problem Sets
            </h3>

            {course.assignments && course.assignments.length > 0 ? (
              <div className="space-y-4">
                {course.assignments.map((a) => (
                  <div key={a.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50/40 text-xs space-y-2 card-interactive">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-900">{a.title}</h4>
                      <span className="font-semibold text-slate-600 bg-white px-2.5 py-0.5 rounded-full border border-slate-200 text-[11px]">{a.totalPoints} Total Points</span>
                    </div>
                    <p className="text-slate-600">{a.description}</p>
                    <div className="flex items-center justify-between pt-2.5 border-t border-slate-200/80 text-[11px]">
                      <span className="text-slate-500">Due: {new Date(a.dueDate).toLocaleString()}</span>
                      <Link
                        href="/student/assignments"
                        className="font-bold text-blue-700 hover:text-blue-900 transition-colors"
                      >
                        Submit Solution →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No Assignments" description="No assignments currently active." />
            )}
          </div>
        )}

        {/* Tab 4: Quizzes */}
        {activeTab === "quizzes" && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100 mb-4">
              Topic Assessments & Practice Quizzes
            </h3>

            {course.quizzes && course.quizzes.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-4">
                {course.quizzes.map((q) => (
                  <div key={q.id} className="border border-slate-200 rounded-xl p-5 bg-white flex flex-col justify-between text-xs card-interactive shadow-2xs">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="info">{q.difficulty}</Badge>
                        <span className="text-slate-500 font-medium text-[11px]">⏱️ {q.timeLimitMinutes} mins</span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mb-1">{q.title}</h4>
                      <p className="text-slate-600 mb-4 text-[11px]">Topic: {q.topic}</p>
                    </div>

                    <Link
                      href={`/student/quizzes/${q.id}`}
                      className="mt-2 text-center py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg shadow-xs btn-press"
                    >
                      Start Assessment ({q.totalQuestions} Questions) →
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No Quizzes Available" description="There are no active quizzes for this course." />
            )}
          </div>
        )}

        {/* Tab 5: AI Course Tutor */}
        {activeTab === "tutor" && (
          <div>
            <AIChatBox courseId={course.id} courses={[course]} />
          </div>
        )}
      </main>

      {/* PDF Reading Modal */}
      {viewingMaterial && (
        <PDFViewerModal
          material={viewingMaterial}
          onClose={() => setViewingMaterial(null)}
          onProgressUpdate={(updated) => {
            setCourse((prev) => {
              if (!prev || !prev.materials) return prev;
              return {
                ...prev,
                materials: prev.materials.map((m) =>
                  m.id === updated.materialId ? { ...m, progress: updated } : m
                ),
              };
            });
          }}
        />
      )}
    </div>
  );
}
