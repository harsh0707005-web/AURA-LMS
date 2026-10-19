"use client";

import React, { useCallback, useEffect, useState } from "react";
import Topbar from "@/components/layout/Topbar";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/SkeletonLoader";
import { apiRequest } from "@/lib/api";
import { FacultyApplication } from "@/lib/types";

type Decision = "approve" | "reject";

function statusVariant(status: FacultyApplication["status"]): "default" | "info" | "success" | "danger" {
  if (status === "APPROVED") return "success";
  if (status === "REJECTED") return "danger";
  return "info";
}

export default function FacultyApplicationsPage() {
  const [applications, setApplications] = useState<FacultyApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [busyApplicationId, setBusyApplicationId] = useState<string | null>(null);

  const loadApplications = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const response = await apiRequest<FacultyApplication[]>("/admin/faculty-applications");
      setApplications(response.data || []);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load faculty applications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadApplications();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadApplications]);

  const review = async (application: FacultyApplication, decision: Decision) => {
    const actionLabel = decision === "approve" ? "approve" : "reject";
    if (!window.confirm(`Are you sure you want to ${actionLabel} ${application.applicant.name}'s faculty application?`)) return;

    setBusyApplicationId(application.id);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await apiRequest<FacultyApplication>(`/admin/faculty-applications/${application.id}/${decision}`, {
        method: "POST",
        body: JSON.stringify(reviewNote.trim() ? { note: reviewNote.trim() } : {}),
      });
      setReviewNote("");
      setSuccessMessage(`Application ${decision === "approve" ? "approved" : "rejected"} successfully.`);
      await loadApplications();
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update this application.");
    } finally {
      setBusyApplicationId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-surface min-h-screen text-on-surface">
      <Topbar title="Faculty Applications" subtitle="Review institutional faculty requests before activation" />

      <main className="flex-1 p-6 sm:p-8 max-w-7xl mx-auto w-full space-y-6">
        <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-wider text-outline">Institutional governance</p>
            <h1 className="mt-1 text-lg font-bold">Pending faculty applications</h1>
            <p className="mt-1 text-xs text-on-surface-variant max-w-2xl">
              Approving an application activates the applicant as faculty. Rejecting it prevents sign-in for that application. Decisions are recorded with the optional review note.
            </p>
          </div>
          <div className="w-full lg:w-80">
            <label htmlFor="review-note" className="block text-[11px] font-mono uppercase tracking-wider font-semibold text-on-surface mb-1.5">
              Optional review note
            </label>
            <input
              id="review-note"
              type="text"
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
              maxLength={2000}
              placeholder="Add context for the decision"
              className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary transition-colors"
            />
          </div>
        </div>

        {errorMessage && (
          <div className="rounded-xl bg-error-container text-on-error-container px-4 py-3 text-xs font-medium flex items-center gap-2" role="alert">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="rounded-xl bg-secondary-container/50 text-on-surface px-4 py-3 text-xs font-medium flex items-center gap-2" role="status">
            <span className="material-symbols-outlined text-secondary text-[18px]">check_circle</span>
            <span>{successMessage}</span>
          </div>
        )}

        <section className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between gap-3 pb-3.5 border-b border-outline-variant/30">
            <div>
              <h2 className="text-sm font-bold">Application queue</h2>
              <p className="text-[11px] text-on-surface-variant mt-0.5">{applications.length} total application{applications.length === 1 ? "" : "s"}</p>
            </div>
            <button
              type="button"
              onClick={() => void loadApplications()}
              disabled={loading || Boolean(busyApplicationId)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/50 px-3 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container disabled:opacity-50 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="mt-4"><TableSkeleton rows={5} cols={6} /></div>
          ) : errorMessage && applications.length === 0 ? (
            <div className="py-10 text-center text-xs text-on-surface-variant">
              The application queue could not be loaded. Use Refresh to try again.
            </div>
          ) : applications.length === 0 ? (
            <div className="py-8">
              <EmptyState title="No faculty applications" description="There are no faculty applications awaiting or requiring review." />
            </div>
          ) : (
            <div className="overflow-x-auto mt-4 text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-outline-variant/30 text-outline uppercase text-[10px] tracking-wider font-mono">
                    <th className="pb-2.5 font-bold">Applicant</th>
                    <th className="pb-2.5 font-bold">Email</th>
                    <th className="pb-2.5 font-bold">Employee ID</th>
                    <th className="pb-2.5 font-bold">Department</th>
                    <th className="pb-2.5 font-bold">Status</th>
                    <th className="pb-2.5 font-bold text-right">Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {applications.map((application) => {
                    const isBusy = busyApplicationId === application.id;
                    const isPending = application.status === "PENDING";
                    return (
                      <tr key={application.id} className="hover:bg-surface-container-low/70 transition-colors">
                        <td className="py-3 font-bold text-on-surface">{application.applicant.name}</td>
                        <td className="py-3 text-on-surface-variant font-mono text-[11px]">{application.email}</td>
                        <td className="py-3 text-on-surface font-mono text-[11px]">{application.employeeId}</td>
                        <td className="py-3 text-on-surface-variant">{application.applicant.department || "—"}</td>
                        <td className="py-3"><Badge variant={statusVariant(application.status)}>{application.status}</Badge></td>
                        <td className="py-3">
                          {isPending ? (
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => void review(application, "reject")}
                                disabled={Boolean(busyApplicationId)}
                                className="rounded-lg border border-error/40 px-2.5 py-1.5 text-[11px] font-semibold text-error hover:bg-error-container disabled:opacity-50 transition-colors"
                              >
                                {isBusy ? "Saving…" : "Reject"}
                              </button>
                              <button
                                type="button"
                                onClick={() => void review(application, "approve")}
                                disabled={Boolean(busyApplicationId)}
                                className="rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-on-primary hover:bg-primary-container disabled:opacity-50 transition-colors"
                              >
                                {isBusy ? "Saving…" : "Approve"}
                              </button>
                            </div>
                          ) : (
                            <span className="block text-right text-[11px] text-on-surface-variant">
                              {application.reviewedAt ? new Date(application.reviewedAt).toLocaleDateString() : "Reviewed"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
