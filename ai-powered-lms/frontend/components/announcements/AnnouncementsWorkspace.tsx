"use client";

import React, { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { Announcement, Course, UserRole } from "@/lib/types";
import { useAuth } from "@/lib/AuthContext";
import EmptyState from "@/components/ui/EmptyState";

interface AnnouncementsWorkspaceProps {
  role: UserRole;
}

export default function AnnouncementsWorkspace({ role }: AnnouncementsWorkspaceProps) {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [courseId, setCourseId] = useState("");
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const canPublish = role === "FACULTY" || role === "ADMIN";

  async function loadAnnouncements() {
    const response = await apiRequest<Announcement[]>("/announcements");
    if (response.success) setAnnouncements(response.data || []);
  }

  useEffect(() => {
    async function load() {
      if (role === "FACULTY" && !user?.id) return;
      try {
        setLoading(true);
        await loadAnnouncements();
        if (canPublish) {
          const response = role === "FACULTY"
            ? await apiRequest<Course[]>(`/faculty/${user?.id}/courses`)
            : await apiRequest<Course[]>("/courses");
          if (response.success) setCourses(response.data || []);
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Announcements could not be loaded");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [canPublish, role, user?.id]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setPublishing(true);
    try {
      await apiRequest<Announcement>("/announcements", {
        method: "POST",
        body: JSON.stringify({ title, body, courseId: courseId || undefined }),
      });
      setTitle("");
      setBody("");
      setCourseId("");
      setSuccessMessage("Announcement published and enrolled students were notified.");
      await loadAnnouncements();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Announcement could not be published");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-wider text-primary">Academic communication</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-on-surface">Announcements</h2>
          <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">
            {role === "STUDENT"
              ? "Stay current with updates from your courses and the institution."
              : "Publish clear updates to the courses and students you support."}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-on-surface-variant">
          <span className="material-symbols-outlined text-secondary text-[18px]">campaign</span>
          <span>{announcements.length} visible announcements</span>
        </div>
      </div>

      {errorMessage && <div className="rounded-xl bg-error-container px-4 py-3 text-xs font-medium text-on-error-container">{errorMessage}</div>}
      {successMessage && <div className="rounded-xl bg-secondary-container px-4 py-3 text-xs font-medium text-on-secondary-container">{successMessage}</div>}

      {canPublish && (
        <form onSubmit={handleSubmit} className="rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-5 shadow-xs sm:p-6">
          <div className="mb-5 flex items-center gap-2 border-b border-outline-variant/30 pb-3">
            <span className="material-symbols-outlined text-primary">edit_note</span>
            <div>
              <h3 className="text-sm font-bold text-on-surface">Publish an announcement</h3>
              <p className="text-[11px] text-on-surface-variant">Students in the selected course will receive a notification.</p>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-on-surface">Title</label>
              <input
                required
                maxLength={160}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Midterm review session"
                className="w-full rounded-lg border border-outline-variant/50 bg-surface-container-low p-3 text-sm text-on-surface outline-none transition-colors focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-on-surface">Audience</label>
              <select
                required={role === "FACULTY"}
                value={courseId}
                onChange={(event) => setCourseId(event.target.value)}
                className="w-full rounded-lg border border-outline-variant/50 bg-surface-container-low p-3 text-sm text-on-surface outline-none transition-colors focus:border-primary"
              >
                {role === "ADMIN" && <option value="">All active students</option>}
                {role === "FACULTY" && <option value="">Select a course</option>}
                {courses.map((course) => <option key={course.id} value={course.id}>{course.code} — {course.title}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-on-surface">Message</label>
            <textarea
              required
              maxLength={5000}
              rows={5}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Share the important details, dates, or next steps..."
              className="w-full resize-y rounded-lg border border-outline-variant/50 bg-surface-container-low p-3 text-sm leading-relaxed text-on-surface outline-none transition-colors focus:border-primary"
            />
          </div>
          <div className="mt-4 flex justify-end">
            <button type="submit" disabled={publishing || (role === "FACULTY" && !courseId)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-on-primary transition-colors hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-50">
              <span className="material-symbols-outlined text-[17px]">send</span>
              {publishing ? "Publishing..." : "Publish announcement"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-8 text-center text-sm text-on-surface-variant">Loading announcements...</div>
      ) : announcements.length === 0 ? (
        <EmptyState icon="campaign" title="No announcements yet" description="Course and institutional updates will appear here when they are published." />
      ) : (
        <div className="space-y-3">
          {announcements.map((announcement) => (
            <article key={announcement.id} className="rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-5 shadow-xs sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-primary-fixed px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                      {announcement.course ? announcement.course.code : "Institution"}
                    </span>
                    <span className="text-[11px] text-outline">{new Date(announcement.createdAt).toLocaleString()}</span>
                  </div>
                  <h3 className="text-base font-bold text-on-surface">{announcement.title}</h3>
                  <p className="mt-1 text-xs text-on-surface-variant">{announcement.course?.title || "All active students"}{announcement.author?.name ? ` • ${announcement.author.name}` : ""}</p>
                </div>
                <span className="material-symbols-outlined text-secondary" aria-hidden="true">campaign</span>
              </div>
              <p className="mt-4 whitespace-pre-wrap border-t border-outline-variant/30 pt-4 text-sm leading-relaxed text-on-surface-variant">{announcement.body}</p>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
