"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiRequest } from "@/lib/api";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const readToken = useRef(false);

  useEffect(() => {
    if (readToken.current) return;
    readToken.current = true;
    const queryToken = searchParams.get("token");
    const fragmentToken = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("token");
    const nextToken = queryToken || fragmentToken;
    setToken(nextToken);
    setLoading(false);
    if (fragmentToken) window.history.replaceState(null, "", window.location.pathname + window.location.search);
    if (!nextToken) queueMicrotask(() => setErrorMessage("This password reset link is missing its token. Request a new link."));
  }, [searchParams]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setErrorMessage("");
    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      setComplete(true);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "This reset link is invalid or expired.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-surface flex items-center justify-center p-4 text-on-surface">
      <section className="w-full max-w-lg bg-surface-container-lowest border border-outline-variant/40 rounded-2xl shadow-xl p-7 sm:p-10 animate-fade-in">
        <Link href="/" className="inline-flex items-center gap-2.5 mb-8">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-primary-container flex items-center justify-center text-on-primary shadow-sm">
            <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
          </span>
          <span className="text-xl font-bold tracking-tight">AURA LMS</span>
        </Link>

        <h1 className="text-xl font-bold tracking-tight">Choose a new password</h1>
        <p className="mt-2 text-sm text-on-surface-variant">Use at least 8 characters. This reset link can only be used once.</p>

        {loading ? (
          <p className="mt-6 text-sm text-on-surface-variant" role="status">Checking your reset link…</p>
        ) : complete ? (
          <div className="mt-6 rounded-xl border border-secondary/40 bg-secondary-container/30 px-4 py-4 text-sm" role="status">
            <p className="font-semibold">Password updated successfully.</p>
            <p className="mt-1 text-on-surface-variant">You can now sign in with your new password.</p>
            <Link href="/login" className="mt-4 inline-flex items-center gap-1 font-semibold text-primary hover:text-primary-container">
              Continue to sign in
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-sm">
            {errorMessage && <div className="p-3 bg-error-container text-on-error-container text-xs rounded-xl" role="alert">{errorMessage}</div>}
            {token && <>
              <div>
                <label htmlFor="new-password" className="block font-semibold text-on-surface mb-1.5 font-mono text-[11px] uppercase tracking-wider">New password</label>
                <input id="new-password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full bg-surface-container-low border border-outline-variant/50 text-on-surface rounded-lg p-2.5 focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label htmlFor="confirm-password" className="block font-semibold text-on-surface mb-1.5 font-mono text-[11px] uppercase tracking-wider">Confirm password</label>
                <input id="confirm-password" type="password" required minLength={8} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full bg-surface-container-low border border-outline-variant/50 text-on-surface rounded-lg p-2.5 focus:outline-none focus:border-primary" />
              </div>
              <button type="submit" disabled={submitting} className="w-full py-2.5 bg-primary hover:bg-primary-container text-on-primary font-semibold rounded-lg shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {submitting && <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {submitting ? "Updating password…" : "Update password"}
              </button>
            </>}
            {!token && <Link href="/forgot-password" className="inline-flex font-semibold text-primary hover:text-primary-container">Request a new reset link</Link>}
          </form>
        )}
      </section>
    </main>
  );
}

export default function ResetPasswordPage() {
  return <Suspense fallback={<main className="min-h-screen bg-surface" />}><ResetPasswordContent /></Suspense>;
}
