"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserRole } from "@/lib/types";
import { useAuth } from "@/lib/AuthContext";
import { apiRequest } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [role, setRole] = useState<UserRole>("STUDENT");
  const [email, setEmail] = useState("harsh.ce@college.edu");
  const [password, setPassword] = useState("Password123");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    setErrorMessage("");
    if (newRole === "STUDENT") setEmail("harsh.ce@college.edu");
    else if (newRole === "FACULTY") setEmail("dr.rajesh@college.edu");
    else setEmail("admin.ce@college.edu");
    setPassword("Password123");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    try {
      const res = await apiRequest<{ token: string; user: any }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      if (res.success && res.data?.token) {
        login(res.data.token, res.data.user);

        const targetRole = res.data.user.role;
        if (targetRole === "STUDENT") router.push("/student/dashboard");
        else if (targetRole === "FACULTY") router.push("/faculty/dashboard");
        else router.push("/admin/dashboard");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Invalid credentials or authentication server unreachable");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl w-full bg-white border border-slate-200 rounded-xl shadow-xs grid md:grid-cols-2 overflow-hidden">
        {/* Left Column: Academic / Institutional Context */}
        <div className="bg-slate-900 text-white p-8 flex flex-col justify-between">
          <div>
            <Link href="/" className="inline-flex items-center space-x-2.5 mb-8">
              <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                A
              </div>
              <span className="text-xl font-bold tracking-tight">AURA LMS</span>
            </Link>

            <div className="space-y-4">
              <h2 className="text-xl font-bold leading-snug">
                University Academic Portal & Resource System
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Integrated course workspace with diagnostic weak-topic tracking, syllabus-grounded AI tutoring, and learning analytics.
              </p>
            </div>

            <div className="mt-8 space-y-2.5 text-xs text-slate-300">
              <div className="flex items-center space-x-2">
                <span className="text-blue-400">✓</span>
                <span>Department of Computer Engineering</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-blue-400">✓</span>
                <span>Academic Session 2026</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-blue-400">✓</span>
                <span>PostgreSQL Relational Storage Architecture</span>
              </div>
            </div>
          </div>

          {/* Quick Demo Credentials Info */}
          <div className="mt-8 pt-4 border-t border-slate-800 text-[11px] text-slate-400">
            <div className="font-semibold text-slate-300 mb-1">Demo Institutional Accounts:</div>
            <div>Student: <code className="text-blue-300">harsh.ce@college.edu</code></div>
            <div>Faculty: <code className="text-blue-300">dr.rajesh@college.edu</code></div>
            <div>Admin: <code className="text-blue-300">admin.ce@college.edu</code></div>
            <div className="mt-1 text-[10px] text-slate-500">Password: Password123</div>
          </div>
        </div>

        {/* Right Column: Clean Login Form */}
        <div className="p-8 sm:p-10 flex flex-col justify-center animate-slide-up">
          <div className="mb-6">
            <h3 className="text-xl font-bold text-slate-900 font-sans tracking-tight">Sign in to your account</h3>
            <p className="text-xs text-slate-500 mt-1">Select your role to access your academic workspace</p>
          </div>

          {/* Role Tabs */}
          <div className="bg-slate-100/80 border border-slate-200/60 p-1 rounded-lg grid grid-cols-3 gap-1 mb-5">
            {[
              { key: "STUDENT", label: "Student", icon: "🎓" },
              { key: "FACULTY", label: "Faculty", icon: "👨‍🏫" },
              { key: "ADMIN", label: "Admin", icon: "🛡️" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => handleRoleChange(item.key as UserRole)}
                className={`py-2 rounded-md text-xs font-semibold transition-all duration-150 cursor-pointer flex items-center justify-center space-x-1.5 ${
                  role === item.key
                    ? "bg-white text-blue-900 shadow-2xs border border-slate-200/60"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                }`}
              >
                <span className="text-xs">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md animate-fade-in flex items-start space-x-2">
              <span className="shrink-0 font-bold">⚠️</span>
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5 font-mono text-[11px] uppercase tracking-wider">
                {role === "STUDENT" ? "Institutional Email" : "Staff / Faculty Email"}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.name@college.edu"
                className="w-full bg-white border border-slate-300 text-slate-900 rounded-md p-2.5 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 font-medium transition-all"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="font-semibold text-slate-700 font-mono text-[11px] uppercase tracking-wider">Password</label>
                <span className="text-[10px] text-slate-500 font-mono">Default: Password123</span>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white border border-slate-300 text-slate-900 rounded-md p-2.5 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-press w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-semibold py-2.5 rounded-md text-xs shadow-xs transition-colors cursor-pointer flex items-center justify-center space-x-2"
            >
              {loading && (
                <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              <span>{loading ? "Authenticating..." : `Sign In as ${role.toLowerCase()} →`}</span>
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center text-xs text-slate-500">
            Need an academic account?{" "}
            <Link href="/register" className="font-semibold text-blue-700 hover:text-blue-900 hover:underline">
              Register here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
