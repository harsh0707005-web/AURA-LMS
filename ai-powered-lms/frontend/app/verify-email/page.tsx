"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiRequest } from "@/lib/api";

type VerificationState = "loading" | "success" | "expired" | "error";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<VerificationState>("loading");
  const [message, setMessage] = useState("Checking your verification link…");
  const submittedToken = useRef<string | null>(null);

  useEffect(() => {
    const queryToken = searchParams.get("token");
    const fragmentToken = typeof window !== "undefined"
      ? new URLSearchParams(window.location.hash.replace(/^#/, "")).get("token")
      : null;
    const token = queryToken || fragmentToken;
    let cancelled = false;
    if (!token) {
      queueMicrotask(() => {
        if (cancelled) return;
        setState("error");
        setMessage("This verification link is missing its token. Request a new link from your institution.");
      });
      return () => {
        cancelled = true;
      };
    }

    // Prevent a second request during development Strict Mode without ever exposing the token.
    if (submittedToken.current === token) return;
    submittedToken.current = token;

    if (fragmentToken && typeof window !== "undefined") {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }

    async function verify() {
      try {
        const response = await apiRequest<{ status: "ACTIVE"; message: string }>("/auth/verify-email", {
          method: "POST",
          body: JSON.stringify({ token }),
        });
        if (!cancelled) {
          setState("success");
          setMessage(response.data?.message || "Email verified. You can now sign in.");
        }
      } catch (error: unknown) {
        if (cancelled) return;
        const errorMessage = error instanceof Error ? error.message : "We could not verify this link.";
        const isExpired = /invalid|expired|verification token/i.test(errorMessage);
        setState(isExpired ? "expired" : "error");
        setMessage(
          isExpired
            ? "This verification link is invalid or has expired. Request a new link from your institution."
            : "We could not verify this link right now. Please try again later or contact your institution."
        );
      }
    }

    void verify();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const stateContent = {
    loading: { icon: "progress_activity", title: "Verifying your email", tone: "text-primary", spin: true },
    success: { icon: "check_circle", title: "Email verified", tone: "text-secondary", spin: false },
    expired: { icon: "schedule", title: "Verification link expired", tone: "text-tertiary", spin: false },
    error: { icon: "error", title: "Verification unavailable", tone: "text-error", spin: false },
  }[state];

  return (
    <main className="min-h-screen bg-surface flex items-center justify-center p-4 text-on-surface">
      <section className="w-full max-w-lg bg-surface-container-lowest border border-outline-variant/40 rounded-2xl shadow-xl p-7 sm:p-10 text-center animate-fade-in">
        <Link href="/" className="inline-flex items-center gap-2.5 mb-8">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-primary-container flex items-center justify-center text-on-primary shadow-sm">
            <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
          </span>
          <span className="text-xl font-bold tracking-tight">AURA LMS</span>
        </Link>

        <div className={`mx-auto mb-5 w-14 h-14 rounded-2xl bg-surface-container-low flex items-center justify-center ${stateContent.tone}`}>
          <span className={`material-symbols-outlined text-[30px] ${stateContent.spin ? "animate-spin" : ""}`}>
            {stateContent.icon}
          </span>
        </div>
        <h1 className="text-xl font-bold tracking-tight">{stateContent.title}</h1>
        <p className="mt-2 text-sm text-on-surface-variant" role={state === "loading" ? "status" : "alert"}>
          {message}
        </p>

        {state !== "loading" && (
          <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/login" className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-colors">
              Continue to sign in
            </Link>
            {state !== "success" && (
              <Link href="/register" className="w-full sm:w-auto px-5 py-2.5 rounded-lg border border-outline-variant/60 text-on-surface-variant text-xs font-semibold hover:bg-surface-container transition-colors">
                Return to registration
              </Link>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface" />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
