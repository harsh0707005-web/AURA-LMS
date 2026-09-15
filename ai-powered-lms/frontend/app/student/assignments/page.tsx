"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { apiRequest } from "@/lib/api";
import { Course, Assignment } from "@/lib/types";
import Topbar from "@/components/layout/Topbar";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";

import SkeletonLoader, { CardSkeleton } from "@/components/ui/SkeletonLoader";

export default function StudentAssignmentsPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  // Submit Modal State
  const [submittingAssignment, setSubmittingAssignment] = useState<Assignment | null>(null);
  const [submissionContent, setSubmissionContent] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!user) return;
      try {
        setLoading(true);
        const coursesRes = await apiRequest<Course[]>(`/students/${user.id}/courses`);
        if (coursesRes.success && coursesRes.data) {
          setCourses(coursesRes.data);

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
    }

    loadData();
  }, [user]);

  const handleSubmitSolution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submittingAssignment) return;

    setSubmitting(true);
    try {
      await apiRequest(`/assignments/${submittingAssignment.id}/submissions`, {
        method: "POST",
        body: JSON.stringify({
          content: submissionContent || "Solution uploaded via student workspace portal.",
          fileUrl: fileUrl || `/uploads/submissions/${Date.now()}_solution.pdf`,
        }),
      });

      setSubmitSuccess(true);
      setTimeout(() => {
        setSubmittingAssignment(null);
        setSubmitSuccess(false);
        setSubmissionContent("");
        setFileUrl("");
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      alert(err.message || "Failed to submit assignment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <Topbar title="Academic Assignments" subtitle="Problem Sets & Lab Submissions" />

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6 animate-fade-in">
        {loading ? (
          <div className="grid md:grid-cols-2 gap-6">
            <CardSkeleton count={4} />
          </div>
        ) : assignments.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-6">
            {assignments.map((a) => {
              const submission = a.submissions && a.submissions.length > 0 ? a.submissions[0] : null;
              const isGraded = submission?.status === "GRADED";
              const isSubmitted = !!submission;

              return (
                <div
                  key={a.id}
                  className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between text-xs space-y-4 card-interactive"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        {a.course && (
                          <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-900 font-bold border border-blue-200 text-[10px] tracking-wider uppercase">
                            {a.course.code}
                          </span>
                        )}
                        <span className="font-semibold text-slate-500">{a.totalPoints} Points</span>
                      </div>

                      <Badge
                        variant={isGraded ? "success" : isSubmitted ? "info" : "warning"}
                      >
                        {isGraded ? `Graded: ${submission?.score}/${a.totalPoints}` : isSubmitted ? "Submitted" : "Pending"}
                      </Badge>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 mb-1.5">{a.title}</h3>
                    <p className="text-slate-600 leading-relaxed">{a.description}</p>
                  </div>

                  {/* Feedback if graded */}
                  {isGraded && submission?.feedback && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-[11px] animate-fade-in">
                      <strong className="block text-emerald-950 font-bold mb-0.5">Faculty Evaluation Feedback:</strong> {submission.feedback}
                    </div>
                  )}

                  <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-slate-500 font-medium">
                      Due: {new Date(a.dueDate).toLocaleDateString()}
                    </span>

                    <button
                      onClick={() => setSubmittingAssignment(a)}
                      className={`px-4 py-2 font-semibold rounded-lg text-xs transition-all cursor-pointer btn-press ${
                        isSubmitted
                          ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300"
                          : "bg-blue-700 hover:bg-blue-800 text-white shadow-xs"
                      }`}
                    >
                      {isSubmitted ? "Update Submission" : "Submit Assignment →"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No Assignments Found"
            description="You do not have any pending or submitted assignments across your courses."
          />
        )}

        {/* Submit Modal */}
        {submittingAssignment && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl text-xs">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Submit: {submittingAssignment.title}
                  </h3>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    {submittingAssignment.course?.code} • {submittingAssignment.totalPoints} Points
                  </p>
                </div>
                <button
                  onClick={() => setSubmittingAssignment(null)}
                  className="text-slate-400 hover:text-slate-700 font-bold text-xl cursor-pointer p-1"
                >
                  ×
                </button>
              </div>

              {submitSuccess ? (
                <div className="p-5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-center font-medium animate-fade-in">
                  ✓ Assignment solution submitted successfully!
                </div>
              ) : (
                <form onSubmit={handleSubmitSolution} className="space-y-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5">
                      Solution Notes / Methodology
                    </label>
                    <textarea
                      rows={4}
                      value={submissionContent}
                      onChange={(e) => setSubmissionContent(e.target.value)}
                      placeholder="Briefly describe your solution approach or paste execution output..."
                      className="w-full bg-white border border-slate-300 rounded-lg p-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5">
                      Attached File URL or Artifact Link
                    </label>
                    <input
                      type="text"
                      value={fileUrl}
                      onChange={(e) => setFileUrl(e.target.value)}
                      placeholder="e.g. /submissions/harsh_lab2_solution.pdf"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs transition-colors"
                    />
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2.5">
                    <button
                      type="button"
                      onClick={() => setSubmittingAssignment(null)}
                      className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-5 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 active:scale-95 text-white font-semibold shadow-xs cursor-pointer transition-all btn-press"
                    >
                      {submitting ? "Submitting..." : "Submit to Instructor →"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
