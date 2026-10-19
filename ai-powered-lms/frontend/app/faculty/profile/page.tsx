"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { apiRequest } from "@/lib/api";
import Topbar from "@/components/layout/Topbar";
import { User } from "@/lib/types";

export default function FacultyProfilePage() {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [department, setDepartment] = useState(user?.department || "Computer Engineering");
  const [employeeId, setEmployeeId] = useState(user?.employeeId || "");
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      const res = await apiRequest<User>("/profile", {
        method: "PUT",
        body: JSON.stringify({ name, department, employeeId }),
      });

      if (res.success && res.data) {
        updateUser(res.data);
        setSuccessMessage("Faculty profile updated successfully!");
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-surface min-h-screen text-on-surface">
      <Topbar title="Faculty Member Profile" subtitle="Academic Staff Credentials" />

      <main className="flex-1 p-6 sm:p-8 max-w-3xl mx-auto w-full space-y-6">
        <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-7 shadow-xs text-xs space-y-6">
          <div className="flex items-center space-x-4 pb-6 border-b border-outline-variant/30">
            <div className="h-16 w-16 rounded-2xl bg-primary text-on-primary font-bold text-2xl flex items-center justify-center shadow-xs">
              {user?.name ? user.name.charAt(0).toUpperCase() : "F"}
            </div>
            <div>
              <h2 className="text-lg font-bold text-on-surface">{user?.name || "Faculty Member"}</h2>
              <p className="text-on-surface-variant font-mono text-[11px] mt-0.5">{user?.email}</p>
              <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full bg-surface-container text-primary text-[10px] font-bold border border-outline-variant/40 font-mono">
                ROLE: {user?.role}
              </span>
            </div>
          </div>

          {successMessage && (
            <div className="p-3.5 bg-secondary-container/60 border border-secondary text-on-surface rounded-xl font-medium flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-[18px]">check_circle</span>
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 bg-error-container text-on-error-container rounded-xl font-medium flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block font-semibold text-on-surface mb-1.5 font-mono text-[11px] uppercase tracking-wider">
                Full Name & Academic Title
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg p-2.5 text-on-surface focus:outline-none focus:border-primary transition-colors font-medium"
              />
            </div>

            <div>
              <label className="block font-semibold text-on-surface mb-1.5 font-mono text-[11px] uppercase tracking-wider">
                Institutional Email (Read Only)
              </label>
              <input
                type="email"
                disabled
                value={user?.email || ""}
                className="w-full bg-surface-container border border-outline-variant/30 rounded-lg p-2.5 text-outline cursor-not-allowed font-mono text-[11px]"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-on-surface mb-1.5 font-mono text-[11px] uppercase tracking-wider">
                  Faculty Employee ID
                </label>
                <input
                  type="text"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg p-2.5 text-on-surface focus:outline-none focus:border-primary font-mono uppercase transition-colors"
                />
              </div>

              <div>
                <label className="block font-semibold text-on-surface mb-1.5 font-mono text-[11px] uppercase tracking-wider">
                  Department
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg p-2.5 text-on-surface focus:outline-none focus:border-primary transition-colors font-medium"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-outline-variant/30 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-primary hover:bg-primary-container text-on-primary font-semibold rounded-lg shadow-xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <span>{saving ? "Saving Changes..." : "Update Profile"}</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
