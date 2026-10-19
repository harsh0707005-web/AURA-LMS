"use client";

import React, { useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";

interface RegisterResponsePayload {
  status: "PENDING_EMAIL" | "PENDING_FACULTY_APPROVAL";
  message: string;
  verificationDelivery?: "SENT" | "NOT_CONFIGURED" | "FAILED";
}

export default function RegisterPage() {
  const [mode, setMode] = useState<"STUDENT" | "FACULTY">("STUDENT");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [enrollmentNo, setEnrollmentNo] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [department, setDepartment] = useState("Computer Engineering");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [registrationResult, setRegistrationResult] = useState<RegisterResponsePayload | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");
    setRegistrationResult(null);

    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters long");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const regRes = await apiRequest<RegisterResponsePayload>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          accountType: mode,
          department,
          enrollmentNo: mode === "STUDENT" ? enrollmentNo.trim() : undefined,
          employeeId: mode === "FACULTY" ? employeeId.trim() : undefined,
        }),
      });

      if (regRes.success && regRes.data) setRegistrationResult(regRes.data);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4 sm:p-6 lg:p-8 text-on-surface">
      <div className="max-w-2xl w-full bg-surface-container-lowest border border-outline-variant/40 rounded-2xl shadow-xl p-6 sm:p-10 animate-fade-in">
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center space-x-2.5 mb-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-primary-container flex items-center justify-center text-on-primary shadow-sm">
              <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-on-surface">AURA LMS</span>
          </Link>
          <h2 className="text-lg sm:text-xl font-bold text-on-surface">Create your academic account</h2>
          <p className="text-xs text-on-surface-variant mt-1">Department of Computer Engineering • Academic Session 2026</p>
        </div>

        {/* Registration modes express an application type, never an authorization role. */}
        <div className="bg-surface-container-low border border-outline-variant/40 p-1 rounded-xl grid grid-cols-2 gap-1 mb-6 max-w-sm mx-auto">
          <button
            type="button"
            onClick={() => {
              setMode("STUDENT");
              setRegistrationResult(null);
              setErrorMessage("");
            }}
            className={`py-2 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer flex items-center justify-center space-x-1.5 ${
              mode === "STUDENT"
                ? "bg-surface-container-lowest text-primary shadow-xs font-bold"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">school</span>
            <span>Student Registration</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("FACULTY");
              setRegistrationResult(null);
              setErrorMessage("");
            }}
            className={`py-2 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer flex items-center justify-center space-x-1.5 ${
              mode === "FACULTY"
                ? "bg-surface-container-lowest text-primary shadow-xs font-bold"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">badge</span>
            <span>Faculty Application</span>
          </button>
        </div>

        <div className="mb-5 rounded-xl border border-primary/20 bg-primary-container/30 px-4 py-3 text-xs text-on-surface-variant">
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]">verified_user</span>
            <p>
              {mode === "STUDENT"
                ? "Student registration is matched to an active institutional enrollment record. You will need to verify your email before signing in."
                : "Faculty applications are reviewed by an administrator before the account can be activated. No account is signed in automatically."}
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-error-container text-on-error-container text-xs rounded-xl flex items-center space-x-2 font-medium">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {registrationResult && (
          <div className="mb-5 rounded-xl border border-secondary/40 bg-secondary-container/30 px-4 py-4 text-xs text-on-surface" role="status">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-secondary text-[20px]">check_circle</span>
              <div>
                <p className="font-bold">
                  {registrationResult.status === "PENDING_EMAIL" ? "Registration received" : "Faculty application received"}
                </p>
                <p className="mt-1 text-on-surface-variant">
                  {registrationResult.message ||
                    (registrationResult.status === "PENDING_EMAIL"
                      ? "Check your institutional inbox for a verification link. You can sign in after your email is verified."
                      : "An administrator must approve your application before you can sign in.")}
                </p>
              </div>
            </div>
            <Link href="/login" className="mt-3 inline-flex items-center gap-1 font-semibold text-primary hover:text-primary-container">
              Return to sign in
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </Link>
          </div>
        )}

        {!registrationResult && <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-on-surface mb-1 font-mono text-[11px] uppercase tracking-wider">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Harsh Vardhan"
                className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg p-2.5 text-on-surface focus:outline-none focus:border-primary font-medium transition-colors"
              />
            </div>

            <div>
              <label className="block font-semibold text-on-surface mb-1 font-mono text-[11px] uppercase tracking-wider">Institutional Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="harsh.ce@college.edu"
                className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg p-2.5 text-on-surface focus:outline-none focus:border-primary font-medium transition-colors"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {mode === "STUDENT" ? (
              <div>
                <label className="block font-semibold text-on-surface mb-1 font-mono text-[11px] uppercase tracking-wider">Enrollment ID</label>
                <input
                  type="text"
                  required
                  value={enrollmentNo}
                  onChange={(e) => setEnrollmentNo(e.target.value)}
                  placeholder="BE-2022-CS-104"
                  className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg p-2.5 text-on-surface focus:outline-none focus:border-primary font-mono uppercase transition-colors"
                />
              </div>
            ) : (
              <div>
                <label className="block font-semibold text-on-surface mb-1 font-mono text-[11px] uppercase tracking-wider">Employee ID</label>
                <input
                  type="text"
                  required
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="EMP-CS-042"
                  className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg p-2.5 text-on-surface focus:outline-none focus:border-primary font-mono uppercase transition-colors"
                />
              </div>
            )}

            <div>
              <label className="block font-semibold text-on-surface mb-1 font-mono text-[11px] uppercase tracking-wider">Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg p-2.5 text-on-surface focus:outline-none focus:border-primary font-medium transition-colors"
              >
                <option value="Computer Engineering">Computer Engineering</option>
                <option value="Information Technology">Information Technology</option>
                <option value="Artificial Intelligence & Data Science">AI & Data Science</option>
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-on-surface mb-1 font-mono text-[11px] uppercase tracking-wider">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters"
                className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg p-2.5 text-on-surface focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="block font-semibold text-on-surface mb-1 font-mono text-[11px] uppercase tracking-wider">Confirm Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg p-2.5 text-on-surface focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary-container text-on-primary font-semibold py-2.5 rounded-lg text-xs shadow-xs transition-all cursor-pointer mt-2 flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {loading && (
              <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            )}
            <span>
              {loading
                ? "Submitting..."
                : mode === "STUDENT"
                ? "Complete Student Registration →"
                : "Submit Faculty Application →"}
            </span>
          </button>
        </form>}

        <div className="mt-6 pt-4 border-t border-outline-variant/30 text-center text-xs text-on-surface-variant">
          Already registered?{" "}
          <Link href="/login" className="font-semibold text-primary hover:text-primary-container transition-colors">
            Sign in here
          </Link>
        </div>
      </div>
    </div>
  );
}
