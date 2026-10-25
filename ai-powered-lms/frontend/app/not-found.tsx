"use client";

import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";

export default function NotFound() {
  const { role, status } = useAuth();
  const dashboardHref = role === "FACULTY"
    ? "/faculty/dashboard"
    : role === "ADMIN"
      ? "/admin/dashboard"
      : "/student/dashboard";

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-16 text-on-surface">
      <section className="w-full max-w-xl rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-8 text-center shadow-xl sm:p-12">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-fixed text-primary">
          <span className="material-symbols-outlined text-[32px]" aria-hidden="true">explore_off</span>
        </div>
        <p className="mt-6 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">AURA LMS / 404</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">That page is not available.</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-on-surface-variant">
          The address may be incorrect, or the page may have moved. Choose a safe place to continue.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/" className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
            Go home
          </Link>
          {status === "authenticated" ? (
            <Link href={dashboardHref} className="rounded-lg border border-outline-variant px-5 py-3 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
              Open dashboard
            </Link>
          ) : (
            <Link href="/login" className="rounded-lg border border-outline-variant px-5 py-3 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
              Sign in
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
