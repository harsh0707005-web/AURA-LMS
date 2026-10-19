"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { apiRequest } from "@/lib/api";
import { Course, Assignment, Submission } from "@/lib/types";
import Topbar from "@/components/layout/Topbar";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/SkeletonLoader";

export default function FacultyAssignmentsPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Assignment Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [targetCourseId, setTargetCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [totalPoints, setTotalPoints] = useState(100);
  const [creating, setCreating] = useState(false);

  // Grade Submissions Modal State
  const [viewingSubmissionsAssignment, setViewingSubmissionsAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [gradingSubmission, setGradingSubmission] = useState<Submission | null>(null);
  const [gradeScore, setGradeScore] = useState<number>(100);
  const [gradeFeedback, setGradeFeedback] = useState("");
  const [grading, setGrading] = useState(false);

  const loadData = React.useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const coursesRes = await apiRequest<Course[]>(`/faculty/${user.id}/courses`);
      if (coursesRes.success && coursesRes.data) {
        setCourses(coursesRes.data);
        if (coursesRes.data.length > 0 && !targetCourseId) {
          setTargetCourseId(coursesRes.data[0].id);
        }

        const allAssignments: Assignment[] = [];
        for (const c of coursesRes.data) {
          const aRes = await apiRequest<Assignment[]>(`/courses/${c.id}/assignments`);
          if (aRes.success && aRes.data) {
            const mapped = aRes.data.map((a) => ({
              ...a,
              course: { id: c.id, code: c.code, title: c.title },
            }));
            allAssignments.push(...mapped);
          }
        }
        setAssignments(allAssignments);
      }
    } catch (err) {
      console.error("Failed to load assignments:", err);
    } finally {
      setLoading(false);
    }
  }, [targetCourseId, user]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCourseId || !title.trim() || !dueDate) return;

    setCreating(true);
    try {
      await apiRequest(`/courses/${targetCourseId}/assignments`, {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          dueDate,
          totalPoints: Number(totalPoints),
        }),
      });

      setIsCreateOpen(false);
      setTitle("");
      setDescription("");
      loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create assignment");
    } finally {
      setCreating(false);
    }
  };

  const handleOpenSubmissions = async (assignment: Assignment) => {
    setViewingSubmissionsAssignment(assignment);
    try {
      const res = await apiRequest<Submission[]>(`/assignments/${assignment.id}/submissions`);
      if (res.success && res.data) {
        setSubmissions(res.data);
      }
    } catch (err) {
      console.error("Failed to load submissions:", err);
    }
  };

  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradingSubmission) return;

    setGrading(true);
    try {
      await apiRequest(`/submissions/${gradingSubmission.id}/grade`, {
        method: "PUT",
        body: JSON.stringify({
          score: Number(gradeScore),
          feedback: gradeFeedback.trim(),
        }),
      });

      if (viewingSubmissionsAssignment) {
        const res = await apiRequest<Submission[]>(`/assignments/${viewingSubmissionsAssignment.id}/submissions`);
        if (res.success && res.data) setSubmissions(res.data);
      }

      setGradingSubmission(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to grade submission");
    } finally {
      setGrading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-surface min-h-screen text-on-surface">
      <Topbar title="Assignment Management & Grading" subtitle="Problem Sets & Evaluation Hub" />

      <main className="flex-1 p-6 sm:p-8 max-w-7xl mx-auto w-full space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-on-surface">Course Assignments</h2>
            <p className="text-xs text-on-surface-variant">Track student submissions, assign rubric scores, and give feedback</p>
          </div>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2.5 bg-primary hover:bg-primary-container text-on-primary font-semibold text-xs rounded-lg shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>+ Create New Assignment</span>
          </button>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 gap-6">
            <CardSkeleton count={4} />
          </div>
        ) : assignments.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-6">
            {assignments.map((a) => (
              <div
                key={a.id}
                className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-5.5 shadow-xs flex flex-col justify-between text-xs space-y-4 hover:border-primary/40 hover:shadow-sm transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center space-x-2">
                      {a.course && (
                        <span className="px-2.5 py-0.5 rounded-md bg-surface-container-high text-primary font-bold border border-outline-variant/40 text-[10px] tracking-wider uppercase font-mono">
                          {a.course.code}
                        </span>
                      )}
                      <span className="font-semibold text-on-surface-variant font-mono text-[11px]">{a.totalPoints} Points</span>
                    </div>

                    <span className="text-on-surface-variant font-medium text-[11px] flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px] text-outline">event</span>
                      Due: {new Date(a.dueDate).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-on-surface mb-1.5 leading-snug">{a.title}</h3>
                  <p className="text-on-surface-variant line-clamp-2 leading-relaxed text-[11px]">
                    {a.description}
                  </p>
                </div>

                <div className="pt-3.5 border-t border-outline-variant/30 flex items-center justify-between">
                  <span className="text-on-surface-variant font-medium text-[11px] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px] text-outline">inbox</span>
                    {a._count?.submissions || (a.submissions ? a.submissions.length : 0)} Submissions Received
                  </span>

                  <button
                    onClick={() => handleOpenSubmissions(a)}
                    className="px-3.5 py-1.5 bg-surface-container-low hover:bg-surface-container border border-outline-variant/40 text-on-surface font-semibold rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1"
                  >
                    <span>Submissions</span>
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No Assignments Created"
            description="You haven't posted any assignments or laboratory tasks yet."
            actionText="Create Assignment"
            onAction={() => setIsCreateOpen(true)}
          />
        )}

        {/* Create Assignment Modal */}
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-2xl max-w-lg w-full p-6 shadow-xl text-xs space-y-4 animate-fade-in">
              <div className="flex items-center justify-between pb-3.5 border-b border-outline-variant/30">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">assignment_add</span>
                  <h3 className="text-base font-bold text-on-surface">Create New Course Assignment</h3>
                </div>
                <button
                  onClick={() => setIsCreateOpen(false)}
                  className="text-outline hover:text-on-surface font-bold text-xl cursor-pointer p-1"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <form onSubmit={handleCreateAssignment} className="space-y-4">
                <div>
                  <label className="block font-semibold text-on-surface mb-1 font-mono text-[11px] uppercase tracking-wider">
                    Target Course
                  </label>
                  <select
                    value={targetCourseId}
                    onChange={(e) => setTargetCourseId(e.target.value)}
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
                    Assignment Title
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Raft Consensus Algorithm Implementation"
                    className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg p-2.5 text-on-surface placeholder:text-outline focus:outline-none focus:border-primary transition-colors"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-on-surface mb-1 font-mono text-[11px] uppercase tracking-wider">
                    Description & Requirements
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide prompt details, expected output artifacts, and evaluation criteria..."
                    className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg p-2.5 text-on-surface placeholder:text-outline focus:outline-none focus:border-primary transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-on-surface mb-1 font-mono text-[11px] uppercase tracking-wider">
                      Due Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg p-2.5 text-on-surface focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-on-surface mb-1 font-mono text-[11px] uppercase tracking-wider">
                      Total Points
                    </label>
                    <input
                      type="number"
                      required
                      min={10}
                      max={200}
                      value={totalPoints}
                      onChange={(e) => setTotalPoints(Number(e.target.value))}
                      className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg p-2.5 text-on-surface focus:outline-none focus:border-primary transition-colors font-mono"
                    />
                  </div>
                </div>

                <div className="pt-3.5 border-t border-outline-variant/30 flex justify-end space-x-2.5">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="px-4 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container font-semibold cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-5 py-2.5 bg-primary hover:bg-primary-container text-on-primary font-semibold rounded-lg shadow-xs cursor-pointer transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <span>{creating ? "Publishing..." : "Publish Assignment"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* View & Grade Submissions Modal */}
        {viewingSubmissionsAssignment && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-2xl max-w-2xl w-full p-6 shadow-xl text-xs space-y-4 max-h-[85vh] flex flex-col animate-fade-in">
              <div className="flex items-center justify-between pb-3.5 border-b border-outline-variant/30">
                <div>
                  <h3 className="text-sm font-bold text-on-surface">
                    Submissions: {viewingSubmissionsAssignment.title}
                  </h3>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    Total Submissions: {submissions.length} • Max Points: {viewingSubmissionsAssignment.totalPoints}
                  </p>
                </div>
                <button
                  onClick={() => setViewingSubmissionsAssignment(null)}
                  className="text-outline hover:text-on-surface font-bold text-xl cursor-pointer p-1"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3">
                {submissions.length > 0 ? (
                  submissions.map((sub) => (
                    <div
                      key={sub.id}
                      className="p-4 border border-outline-variant/30 rounded-xl bg-surface-container-low/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-on-surface">{sub.student?.name || "Student"}</span>
                          <span className="font-mono text-[10px] text-outline">({sub.student?.enrollmentNo || "N/A"})</span>
                          <Badge variant={sub.status === "GRADED" ? "success" : "warning"}>
                            {sub.status === "GRADED" ? `Score: ${sub.score}/${viewingSubmissionsAssignment.totalPoints}` : "Needs Grading"}
                          </Badge>
                        </div>
                        {sub.content && <p className="text-on-surface-variant text-[11px] italic">&quot;{sub.content}&quot;</p>}
                        {sub.feedback && (
                          <div className="text-[11px] text-secondary font-medium flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px]">comment</span>
                            <span>Feedback: {sub.feedback}</span>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => {
                          setGradingSubmission(sub);
                          setGradeScore(sub.score || viewingSubmissionsAssignment.totalPoints);
                          setGradeFeedback(sub.feedback || "Good work.");
                        }}
                        className="px-3.5 py-1.5 bg-primary hover:bg-primary-container text-on-primary font-semibold rounded-lg text-xs shadow-xs shrink-0 cursor-pointer transition-all flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">edit_note</span>
                        <span>{sub.status === "GRADED" ? "Edit Grade" : "Grade Submission"}</span>
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-on-surface-variant">No student submissions received yet.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Grade Form Modal */}
        {gradingSubmission && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-2xl max-w-md w-full p-6 shadow-xl text-xs space-y-4 animate-fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-outline-variant/30">
                <h3 className="text-sm font-bold text-on-surface">
                  Grade Submission: {gradingSubmission.student?.name}
                </h3>
                <button
                  onClick={() => setGradingSubmission(null)}
                  className="text-outline hover:text-on-surface font-bold text-xl cursor-pointer p-1"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <form onSubmit={handleSaveGrade} className="space-y-3.5">
                <div>
                  <label className="block font-semibold text-on-surface mb-1 font-mono text-[11px] uppercase tracking-wider">
                    Score (out of {viewingSubmissionsAssignment?.totalPoints || 100})
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    max={viewingSubmissionsAssignment?.totalPoints || 100}
                    value={gradeScore}
                    onChange={(e) => setGradeScore(Number(e.target.value))}
                    className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg p-2.5 text-on-surface focus:outline-none focus:border-primary font-mono transition-colors"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-on-surface mb-1 font-mono text-[11px] uppercase tracking-wider">
                    Instructor Feedback & Suggestions
                  </label>
                  <textarea
                    rows={3}
                    value={gradeFeedback}
                    onChange={(e) => setGradeFeedback(e.target.value)}
                    placeholder="Provide constructive academic feedback..."
                    className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg p-2.5 text-on-surface focus:outline-none focus:border-primary transition-colors"
                  />
                </div>

                <div className="pt-3.5 border-t border-outline-variant/30 flex justify-end space-x-2.5">
                  <button
                    type="button"
                    onClick={() => setGradingSubmission(null)}
                    className="px-4 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container font-semibold cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={grading}
                    className="px-5 py-2.5 bg-primary hover:bg-primary-container text-on-primary font-semibold rounded-lg shadow-xs cursor-pointer transition-all disabled:opacity-50"
                  >
                    {grading ? "Saving..." : "Save Grade"}
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
