"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { apiRequest } from "@/lib/api";
import { Course, Assignment } from "@/lib/types";
import Topbar from "@/components/layout/Topbar";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/SkeletonLoader";

export default function StudentAssignmentsPage() {
  const { user } = useAuth();
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
          content: submissionContent || "Solution submitted via student workspace portal.",
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit assignment";
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-surface min-h-screen text-on-surface">
      <Topbar title="Academic Assignments" subtitle="Problem Sets & Lab Submissions" />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6 animate-fade-in">
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
                  className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-6 shadow-sm flex flex-col justify-between text-xs space-y-4 hover:border-outline-variant transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {a.course && (
                          <span className="px-2.5 py-0.5 rounded-md bg-primary-fixed text-primary font-bold border border-primary/20 font-label-sm text-[10px] tracking-wider uppercase">
                            {a.course.code}
                          </span>
                        )}
                        <span className="font-label-sm text-outline font-semibold">
                          {a.totalPoints} Points
                        </span>
                      </div>

                      <Badge variant={isGraded ? "success" : isSubmitted ? "info" : "warning"}>
                        {isGraded
                          ? `Graded: ${submission?.score}/${a.totalPoints}`
                          : isSubmitted
                          ? "Submitted"
                          : "Pending"}
                      </Badge>
                    </div>

                    <h3 className="font-headline-sm text-sm font-bold text-on-surface mb-1.5">
                      {a.title}
                    </h3>
                    <p className="font-body-sm text-on-surface-variant leading-relaxed">
                      {a.description}
                    </p>
                  </div>

                  {/* Feedback if graded */}
                  {isGraded && submission?.feedback && (
                    <div className="p-3 bg-[#ecfdf5] border border-[#a7f3d0] rounded-xl text-[#065f46] text-[11px] animate-fade-in">
                      <strong className="block font-bold mb-0.5">Faculty Evaluation Feedback:</strong>{" "}
                      {submission.feedback}
                    </div>
                  )}

                  <div className="pt-3.5 border-t border-surface-container-high flex items-center justify-between">
                    <span className="font-label-sm text-outline text-[11px]">
                      Due: {new Date(a.dueDate).toLocaleDateString()}
                    </span>

                    <button
                      type="button"
                      onClick={() => setSubmittingAssignment(a)}
                      className={`px-4 py-2 font-semibold rounded-xl text-xs transition-all cursor-pointer shadow-2xs ${
                        isSubmitted
                          ? "bg-surface-container hover:bg-surface-container-high text-on-surface border border-surface-container-high"
                          : "bg-primary-container hover:opacity-90 text-on-primary shadow-xs"
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
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Submit Assignment Solution"
            className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          >
            <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl max-w-lg w-full p-6 shadow-xl text-xs space-y-4">
              <div className="flex items-center justify-between pb-3.5 border-b border-surface-container-high">
                <div>
                  <h3 className="font-headline-sm text-sm font-bold text-on-surface">
                    Submit: {submittingAssignment.title}
                  </h3>
                  <p className="font-label-sm text-outline text-[11px] mt-0.5">
                    {submittingAssignment.course?.code} • {submittingAssignment.totalPoints} Points
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSubmittingAssignment(null)}
                  className="text-outline hover:text-on-surface p-1 rounded-lg"
                  aria-label="Close modal"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              {submitSuccess ? (
                <div className="p-5 bg-[#ecfdf5] border border-[#a7f3d0] text-[#065f46] rounded-xl text-center font-medium animate-fade-in">
                  ✓ Assignment solution submitted successfully!
                </div>
              ) : (
                <form onSubmit={handleSubmitSolution} className="space-y-4">
                  <div>
                    <label className="block font-semibold text-on-surface mb-1.5">
                      Solution Notes / Methodology
                    </label>
                    <textarea
                      rows={4}
                      value={submissionContent}
                      onChange={(e) => setSubmissionContent(e.target.value)}
                      placeholder="Briefly describe your solution approach or paste execution output..."
                      className="w-full bg-surface-container-low border border-surface-container-high rounded-xl p-3 text-on-surface placeholder:text-outline focus:outline-hidden focus:ring-1 focus:ring-primary font-body-sm"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-on-surface mb-1.5">
                      Attached File URL or Artifact Link
                    </label>
                    <input
                      type="text"
                      value={fileUrl}
                      onChange={(e) => setFileUrl(e.target.value)}
                      placeholder="e.g. /submissions/student_lab2_solution.pdf"
                      className="w-full bg-surface-container-low border border-surface-container-high rounded-xl p-2.5 text-on-surface placeholder:text-outline focus:outline-hidden focus:ring-1 focus:ring-primary font-body-sm"
                    />
                  </div>

                  <div className="pt-3 border-t border-surface-container-high flex justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setSubmittingAssignment(null)}
                      className="px-4 py-2 rounded-xl text-on-surface-variant hover:bg-surface-container font-semibold cursor-pointer transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-5 py-2 rounded-xl bg-primary-container hover:opacity-90 disabled:opacity-50 text-on-primary font-semibold shadow-xs cursor-pointer transition-opacity"
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
