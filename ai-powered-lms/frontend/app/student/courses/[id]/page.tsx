"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import { Course, Material, MaterialProgress } from "@/lib/types";
import Topbar from "@/components/layout/Topbar";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import AIChatBox from "@/components/tutor/AIChatBox";
import PDFViewerModal from "@/components/materials/PDFViewerModal";
import { CardSkeleton } from "@/components/ui/SkeletonLoader";

type CourseTab = "overview" | "materials" | "assignments" | "quizzes" | "tutor";

export default function StudentCourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const courseId = resolvedParams.id;

  const [course, setCourse] = useState<Course | null>(null);
  const [activeTab, setActiveTab] = useState<CourseTab>("overview");
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

  const handleProgressUpdate = (updated: MaterialProgress) => {
    if (!course) return;
    const updatedMats = (course.materials || []).map((m) =>
      m.id === updated.materialId ? { ...m, progress: updated } : m
    );
    setCourse({ ...course, materials: updatedMats });
    if (viewingMaterial && viewingMaterial.id === updated.materialId) {
      setViewingMaterial({ ...viewingMaterial, progress: updated });
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col bg-surface min-h-screen text-on-surface">
        <Topbar title="Course Workspace" />
        <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
          <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-6 shadow-sm animate-pulse space-y-3">
            <div className="h-6 w-1/3 bg-surface-container-high rounded" />
            <div className="h-4 w-2/3 bg-surface-container rounded" />
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
      <div className="flex-1 flex flex-col bg-surface min-h-screen text-on-surface">
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
    <div className="flex-1 flex flex-col bg-surface min-h-screen text-on-surface">
      <Topbar
        title={`${course.code}: ${course.title}`}
        subtitle={`Department of ${course.department}`}
      />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 animate-fade-in">
        {/* Course Header Banner */}
        <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-6 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="font-label-sm text-xs font-bold bg-primary-fixed text-primary border border-primary/20 px-2.5 py-1 rounded-md uppercase tracking-wider">
                {course.code}
              </span>
              <span className="font-label-sm text-xs font-medium text-outline">
                {course.credits} Credits • Semester {course.semester} • {course.totalModules} Units
              </span>
            </div>
            {course.faculty && (
              <div className="text-xs text-on-surface-variant bg-surface-container-low px-3 py-1.5 rounded-xl border border-surface-container-high flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-outline">person</span>
                <span>Instructor: <strong className="text-on-surface font-semibold">{course.faculty.name}</strong></span>
              </div>
            )}
          </div>

          <h2 className="font-headline-sm text-xl font-bold text-on-surface">{course.title}</h2>
          {course.description && (
            <p className="font-body-sm text-xs text-on-surface-variant leading-relaxed max-w-4xl">
              {course.description}
            </p>
          )}
        </div>

        {/* Course Tabs Navigation */}
        <div className="flex border-b border-surface-container-high gap-2 overflow-x-auto pb-1">
          {[
            { key: "overview", label: "Overview", icon: "dashboard" },
            {
              key: "materials",
              label: `Materials (${course.materials?.length || 0})`,
              icon: "menu_book",
            },
            {
              key: "assignments",
              label: `Assignments (${course.assignments?.length || 0})`,
              icon: "assignment",
            },
            {
              key: "quizzes",
              label: `Quizzes (${course.quizzes?.length || 0})`,
              icon: "quiz",
            },
            { key: "tutor", label: "AI Course Tutor", icon: "smart_toy" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as CourseTab)}
              className={`py-2 px-3.5 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === tab.key
                  ? "bg-primary-container text-on-primary shadow-xs"
                  : "bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container hover:text-on-surface border border-surface-container-high"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab 1: Overview */}
        {activeTab === "overview" && (
          <div className="grid md:grid-cols-3 gap-6 items-start">
            <div className="md:col-span-2 space-y-6">
              <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-5 shadow-sm space-y-3">
                <h3 className="font-headline-sm text-sm font-bold text-on-surface">
                  Curriculum Overview
                </h3>
                <div className="space-y-2 text-xs font-body-sm text-on-surface-variant">
                  <div className="p-3 bg-surface-container-low border border-surface-container-high rounded-xl">
                    <strong className="text-on-surface">Syllabus Framework:</strong>{" "}
                    {course.totalModules} Core Units including Lecture Slides, Problem Sets, and RAG Grounded Notes.
                  </div>
                  <div className="p-3 bg-surface-container-low border border-surface-container-high rounded-xl">
                    <strong className="text-on-surface">Grounded Documents:</strong>{" "}
                    {course.materials?.length || 0} Lecture Documents indexed for automated retrieval.
                  </div>
                </div>
              </div>

              {/* Quick Assignments & Quizzes */}
              <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-5 shadow-sm space-y-3">
                <h3 className="font-headline-sm text-sm font-bold text-on-surface">
                  Assessments & Deadlines
                </h3>
                {course.assignments && course.assignments.length > 0 ? (
                  <div className="space-y-2">
                    {course.assignments.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between p-3 bg-surface-container-low rounded-xl border border-surface-container-high text-xs"
                      >
                        <span className="font-semibold text-on-surface">{a.title}</span>
                        <span className="font-label-sm text-outline text-[11px]">
                          Due: {new Date(a.dueDate).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-on-surface-variant py-2">
                    No active assignments posted.
                  </div>
                )}
              </div>
            </div>

            <div>
              <AIChatBox courseId={course.id} courses={[course]} mode="compact" />
            </div>
          </div>
        )}

        {/* Tab 2: Materials */}
        {activeTab === "materials" && (
          <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
              <h3 className="font-headline-sm text-sm font-bold text-on-surface">
                Lecture Materials & Documents
              </h3>
              <span className="font-label-sm text-xs text-outline">
                {course.materials?.length || 0} Files
              </span>
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
                      className="p-4 border border-surface-container-high rounded-xl bg-surface-container-low/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs shadow-2xs"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-surface-container-lowest border border-surface-container-high flex items-center justify-center text-primary shrink-0 shadow-2xs">
                          <span className="material-symbols-outlined text-[20px]">description</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-bold text-on-surface text-sm">{m.title}</span>
                            {isCompleted ? (
                              <span className="px-2 py-0.5 rounded-md bg-[#ecfdf5] text-[#065f46] font-label-sm text-[10px] font-bold border border-[#a7f3d0]">
                                ✓ Completed
                              </span>
                            ) : percent > 0 ? (
                              <span className="px-2 py-0.5 rounded-md bg-primary-fixed text-primary font-label-sm text-[10px] font-bold border border-primary/20">
                                {percent}%
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-surface-container text-on-surface-variant font-label-sm text-[10px]">
                                Not Started
                              </span>
                            )}
                          </div>
                          <div className="font-label-sm text-[11px] text-outline">
                            {m.unit} • {m.fileSize} • {m.ragChunksCount} Grounded RAG Chunks
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end shrink-0">
                        <div className="w-24 space-y-1">
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
                          onClick={() =>
                            setViewingMaterial({
                              ...m,
                              course: { id: course.id, code: course.code, title: course.title },
                            })
                          }
                          className="px-3.5 py-1.5 bg-primary-container hover:opacity-90 text-on-primary font-semibold rounded-xl text-xs shadow-2xs transition-all shrink-0 cursor-pointer"
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
                title="No Materials Uploaded"
                description="The instructor has not uploaded lecture materials for this course yet."
              />
            )}
          </div>
        )}

        {/* Tab 3: Assignments */}
        {activeTab === "assignments" && (
          <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
              <h3 className="font-headline-sm text-sm font-bold text-on-surface">
                Course Assignments
              </h3>
              <Link
                href="/student/assignments"
                className="font-body-sm text-xs font-semibold text-primary hover:underline"
              >
                Go to Assignment Hub →
              </Link>
            </div>

            {course.assignments && course.assignments.length > 0 ? (
              <div className="space-y-3">
                {course.assignments.map((a) => (
                  <div
                    key={a.id}
                    className="p-4 border border-surface-container-high rounded-xl bg-surface-container-low/60 flex items-center justify-between text-xs"
                  >
                    <div>
                      <h4 className="font-bold text-on-surface text-sm mb-1">{a.title}</h4>
                      <p className="font-label-sm text-outline text-[11px]">
                        Due: {new Date(a.dueDate).toLocaleDateString()} • {a.totalPoints} Points
                      </p>
                    </div>
                    <Link
                      href="/student/assignments"
                      className="px-3.5 py-1.5 rounded-xl bg-primary-container text-on-primary font-semibold text-xs shadow-2xs hover:opacity-90 transition-opacity"
                    >
                      View & Submit →
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No Assignments"
                description="There are no assignments posted for this course."
              />
            )}
          </div>
        )}

        {/* Tab 4: Quizzes */}
        {activeTab === "quizzes" && (
          <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
              <h3 className="font-headline-sm text-sm font-bold text-on-surface">
                Course Quizzes & Assessments
              </h3>
              <Link
                href="/student/quizzes"
                className="font-body-sm text-xs font-semibold text-primary hover:underline"
              >
                Go to Assessments Hub →
              </Link>
            </div>

            {course.quizzes && course.quizzes.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-4">
                {course.quizzes.map((q) => (
                  <div
                    key={q.id}
                    className="p-4 border border-surface-container-high rounded-xl bg-surface-container-low/60 flex flex-col justify-between text-xs space-y-3"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <Badge variant="info">{q.difficulty}</Badge>
                        <span className="font-label-sm text-outline text-[11px]">
                          ⏱️ {q.timeLimitMinutes} mins
                        </span>
                      </div>
                      <h4 className="font-bold text-on-surface text-sm">{q.title}</h4>
                      <p className="font-body-sm text-on-surface-variant text-[11px] mt-0.5">
                        Topic: {q.topic}
                      </p>
                    </div>
                    <Link
                      href={`/student/quizzes/${q.id}`}
                      className="w-full py-2 bg-primary-container text-on-primary font-semibold rounded-xl text-center shadow-2xs hover:opacity-90 transition-opacity"
                    >
                      Start Assessment →
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No Quizzes Available"
                description="No quizzes have been published for this course yet."
              />
            )}
          </div>
        )}

        {/* Tab 5: Tutor Workspace */}
        {activeTab === "tutor" && (
          <div className="space-y-4">
            <AIChatBox courseId={course.id} courses={[course]} mode="full" />
          </div>
        )}
      </main>

      {/* Embedded Document Viewer Modal */}
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
