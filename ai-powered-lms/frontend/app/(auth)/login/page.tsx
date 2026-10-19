"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, UserRole } from "@/lib/types";
import { useAuth } from "@/lib/AuthContext";
import { apiRequest } from "@/lib/api";

interface LoginResponsePayload {
  token: string;
  user: User;
}

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [role, setRole] = useState<UserRole>("STUDENT");
  const [email, setEmail] = useState("harsh.ce@college.edu");
  const [password, setPassword] = useState("Password123");
  const [showPassword, setShowPassword] = useState(false);
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
      const res = await apiRequest<LoginResponsePayload>("/auth/login", {
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
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Invalid credentials or authentication server unreachable");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4 sm:p-6 lg:p-8 text-on-surface">
      <div className="max-w-4xl w-full bg-surface-container-lowest border border-outline-variant/40 rounded-2xl shadow-xl grid md:grid-cols-2 overflow-hidden animate-fade-in">
        {/* Left Column: Academic / Institutional Context */}
        <div className="bg-inverse-surface text-inverse-on-surface p-8 sm:p-10 flex flex-col justify-between">
          <div>
            <Link href="/" className="inline-flex items-center space-x-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-primary-container flex items-center justify-center text-on-primary shadow-sm">
                <span className="material-symbols-outlined text-[22px]">auto_awesome</span>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg tracking-tight leading-none text-white">AURA LMS</span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-outline-variant leading-tight mt-0.5">
                  Academic Precision
                </span>
              </div>
            </Link>

            <div className="space-y-3.5">
              <h2 className="text-xl sm:text-2xl font-bold leading-snug tracking-tight text-white">
                University Academic Portal & Resource System
              </h2>
              <p className="text-xs text-outline-variant leading-relaxed">
                Integrated course workspace with diagnostic weak-topic tracking, syllabus-grounded AI tutoring, and learning analytics.
              </p>
            </div>

            <div className="mt-8 space-y-2.5 text-xs text-outline-variant">
              <div className="flex items-center space-x-2">
                <span className="material-symbols-outlined text-secondary text-[16px]">check_circle</span>
                <span>Department of Computer Engineering</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="material-symbols-outlined text-secondary text-[16px]">check_circle</span>
                <span>Course-Scoped RAG Vector Embeddings</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="material-symbols-outlined text-secondary text-[16px]">check_circle</span>
                <span>PostgreSQL Relational Storage Architecture</span>
              </div>
            </div>
          </div>

          {/* Quick Demo Credentials Info */}
          <div className="mt-8 pt-5 border-t border-outline/30 text-[11px] text-outline-variant space-y-1">
            <div className="font-semibold text-white mb-1.5 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">key</span>
              <span>Demo Institutional Accounts:</span>
            </div>
            <div>Student: <code className="text-primary-container font-mono bg-inverse-surface px-1.5 py-0.5 rounded">harsh.ce@college.edu</code></div>
            <div>Faculty: <code className="text-primary-container font-mono bg-inverse-surface px-1.5 py-0.5 rounded">dr.rajesh@college.edu</code></div>
            <div>Admin: <code className="text-primary-container font-mono bg-inverse-surface px-1.5 py-0.5 rounded">admin.ce@college.edu</code></div>
            <div className="mt-1.5 text-[10px] text-outline font-mono">Password: Password123</div>
          </div>
        </div>

        {/* Right Column: Clean Login Form */}
        <div className="p-8 sm:p-10 flex flex-col justify-center">
          <div className="mb-6">
            <h3 className="text-xl font-bold text-on-surface tracking-tight">Sign in to your account</h3>
            <p className="text-xs text-on-surface-variant mt-1">Select your role to access your academic workspace</p>
          </div>

          {/* Role Tabs */}
          <div className="bg-surface-container-low border border-outline-variant/40 p-1 rounded-xl grid grid-cols-3 gap-1 mb-5">
            {[
              { key: "STUDENT", label: "Student", icon: "school" },
              { key: "FACULTY", label: "Faculty", icon: "badge" },
              { key: "ADMIN", label: "Admin", icon: "admin_panel_settings" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => handleRoleChange(item.key as UserRole)}
                className={`py-2 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer flex items-center justify-center space-x-1.5 ${
                  role === item.key
                    ? "bg-surface-container-lowest text-primary shadow-xs font-bold"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 bg-error-container text-on-error-container text-xs rounded-xl flex items-center space-x-2 font-medium">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-on-surface mb-1.5 font-mono text-[11px] uppercase tracking-wider">
                {role === "STUDENT" ? "Institutional Email" : "Staff / Faculty Email"}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.name@college.edu"
                className="w-full bg-surface-container-low border border-outline-variant/50 text-on-surface rounded-lg p-2.5 focus:outline-none focus:border-primary font-medium transition-colors"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="font-semibold text-on-surface font-mono text-[11px] uppercase tracking-wider">Password</label>
                <span className="text-[10px] text-on-surface-variant font-mono">Default: Password123</span>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-surface-container-low border border-outline-variant/50 text-on-surface rounded-lg p-2.5 pr-10 focus:outline-none focus:border-primary font-medium transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-primary hover:bg-primary-container text-on-primary font-semibold rounded-lg shadow-xs transition-all cursor-pointer flex items-center justify-center space-x-1.5 disabled:opacity-50 mt-2"
            >
              {loading && (
                <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              )}
              <span>{loading ? "Authenticating..." : `Sign in as ${role === "STUDENT" ? "Student" : role === "FACULTY" ? "Faculty" : "Administrator"}`}</span>
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-on-surface-variant">
            <span>Don&apos;t have an institutional account? </span>
            <Link href="/register" className="font-semibold text-primary hover:text-primary-container transition-colors">
              Register here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
