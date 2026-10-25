"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { apiRequest } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrorMessage("");
    try {
      await apiRequest("/auth/request-password-reset", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setSubmitted(true);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "We could not process that request.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-surface flex items-center justify-center p-4 text-on-surface">
      <section className="w-full max-w-lg bg-surface-container-lowest border border-outline-variant/40 rounded-2xl shadow-xl p-7 sm:p-10 animate-fade-in">
        <Link href="/login" className="inline-flex items-center gap-2.5 mb-8">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-primary-container flex items-center justify-center text-on-primary shadow-sm">
            <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
          </span>
          <span className="text-xl font-bold tracking-tight">AURA LMS</span>
        </Link>

        <h1 className="text-xl font-bold tracking-tight">Reset your password</h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Enter your institutional email and we will send a one-time reset link if an active account exists.
        </p>

        {submitted ? (
          <div className="mt-6 rounded-xl border border-secondary/40 bg-secondary-container/30 px-4 py-4 text-sm" role="status">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-secondary text-[20px]">mark_email_read</span>
              <p>If an active account exists for that email, a reset link has been sent. The link expires in one hour.</p>
            </div>
            <Link href="/login" className="mt-4 inline-flex items-center gap-1 font-semibold text-primary hover:text-primary-container">
              Return to sign in
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-sm">
            {errorMessage && (
              <div className="p-3 bg-error-container text-on-error-container text-xs rounded-xl" role="alert">
                {errorMessage}
              </div>
            )}
            <div>
              <label htmlFor="reset-email" className="block font-semibold text-on-surface mb-1.5 font-mono text-[11px] uppercase tracking-wider">
                Institutional email
              </label>
              <input
                id="reset-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="your.name@college.edu"
                className="w-full bg-surface-container-low border border-outline-variant/50 text-on-surface rounded-lg p-2.5 focus:outline-none focus:border-primary font-medium transition-colors"
              />
            </div>
            <button type="submit" disabled={loading} className="w-full py-2.5 bg-primary hover:bg-primary-container text-on-primary font-semibold rounded-lg shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              {loading && <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {loading ? "Sending reset link…" : "Send reset link"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
