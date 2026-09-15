"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserRole } from "@/lib/types";
import { useAuth } from "@/lib/AuthContext";
import { apiRequest } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [role, setRole] = useState<UserRole>("STUDENT");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [enrollmentNo, setEnrollmentNo] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [department, setDepartment] = useState("Computer Engineering");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

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
      const regRes = await apiRequest<{ id: string }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          role,
          department,
          enrollmentNo: role === "STUDENT" ? enrollmentNo.trim() : undefined,
          employeeId: role === "FACULTY" ? employeeId.trim() : undefined,
        }),
      });

      if (regRes.success) {
        // Auto-login upon successful registration
        const loginRes = await apiRequest<{ token: string; user: any }>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
        });

        if (loginRes.success && loginRes.data?.token) {
          login(loginRes.data.token, loginRes.data.user);
          if (role === "STUDENT") router.push("/student/dashboard");
          else router.push("/faculty/dashboard");
        } else {
          router.push("/login");
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl w-full bg-white border border-slate-200 rounded-xl shadow-xs p-6 sm:p-10 animate-slide-up">
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center space-x-2.5 mb-2 group">
            <div className="h-8 w-8 rounded-lg bg-blue-700 group-hover:bg-blue-800 flex items-center justify-center text-white font-bold text-sm shadow-xs transition-colors">
              A
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900 font-sans">AURA LMS</span>
          </Link>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 font-sans">Create your academic account</h2>
          <p className="text-xs text-slate-500 mt-1">Department of Computer Engineering • Academic Session 2026</p>
        </div>

        {/* Role Tabs (Admin hidden) */}
        <div className="bg-slate-100/80 border border-slate-200/60 p-1 rounded-lg grid grid-cols-2 gap-1 mb-6 max-w-sm mx-auto">
          <button
            type="button"
            onClick={() => setRole("STUDENT")}
            className={`py-2 rounded-md text-xs font-semibold transition-all duration-150 cursor-pointer flex items-center justify-center space-x-1.5 ${
              role === "STUDENT"
                ? "bg-white text-blue-900 shadow-2xs border border-slate-200/60"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
            }`}
          >
            <span>🎓 Student Account</span>
          </button>
          <button
            type="button"
            onClick={() => setRole("FACULTY")}
            className={`py-2 rounded-md text-xs font-semibold transition-all duration-150 cursor-pointer flex items-center justify-center space-x-1.5 ${
              role === "FACULTY"
                ? "bg-white text-blue-900 shadow-2xs border border-slate-200/60"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
            }`}
          >
            <span>👨‍🏫 Faculty Account</span>
          </button>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md animate-fade-in flex items-start space-x-2">
            <span className="shrink-0 font-bold">⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1 font-mono text-[11px] uppercase tracking-wider">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Harsh Vardhan"
                className="w-full bg-white border border-slate-300 rounded-md p-2.5 text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 font-medium transition-all"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1 font-mono text-[11px] uppercase tracking-wider">Institutional Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="harsh.ce@college.edu"
                className="w-full bg-white border border-slate-300 rounded-md p-2.5 text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 font-medium transition-all"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {role === "STUDENT" ? (
              <div>
                <label className="block font-semibold text-slate-700 mb-1 font-mono text-[11px] uppercase tracking-wider">Enrollment / Roll No.</label>
                <input
                  type="text"
                  required
                  value={enrollmentNo}
                  onChange={(e) => setEnrollmentNo(e.target.value)}
                  placeholder="BE-2022-CS-104"
                  className="w-full bg-white border border-slate-300 rounded-md p-2.5 text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 font-mono uppercase transition-all"
                />
              </div>
            ) : (
              <div>
                <label className="block font-semibold text-slate-700 mb-1 font-mono text-[11px] uppercase tracking-wider">Faculty Employee ID</label>
                <input
                  type="text"
                  required
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="EMP-CS-042"
                  className="w-full bg-white border border-slate-300 rounded-md p-2.5 text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 font-mono uppercase transition-all"
                />
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 mb-1 font-mono text-[11px] uppercase tracking-wider">Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-md p-2.5 text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 font-medium transition-all"
              >
                <option value="Computer Engineering">Computer Engineering</option>
                <option value="Information Technology">Information Technology</option>
                <option value="Artificial Intelligence & Data Science">AI & Data Science</option>
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1 font-mono text-[11px] uppercase tracking-wider">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters"
                className="w-full bg-white border border-slate-300 rounded-md p-2.5 text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1 font-mono text-[11px] uppercase tracking-wider">Confirm Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white border border-slate-300 rounded-md p-2.5 text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-press w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-semibold py-2.5 rounded-md text-xs shadow-xs transition-colors cursor-pointer mt-2 flex items-center justify-center space-x-2"
          >
            {loading && (
              <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            <span>{loading ? "Creating Account..." : "Complete Registration →"}</span>
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-100 text-center text-xs text-slate-500">
          Already registered?{" "}
          <Link href="/login" className="font-semibold text-blue-700 hover:text-blue-900 hover:underline">
            Sign in here
          </Link>
        </div>
      </div>
    </div>
  );
}
