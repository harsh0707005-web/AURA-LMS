"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { apiRequest } from "@/lib/api";
import Topbar from "@/components/layout/Topbar";
import { User } from "@/lib/types";

export default function StudentProfilePage() {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [department, setDepartment] = useState(user?.department || "Computer Engineering");
  const [enrollmentNo, setEnrollmentNo] = useState(user?.enrollmentNo || "");
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
        body: JSON.stringify({ name, department, enrollmentNo }),
      });

      if (res.success && res.data) {
        updateUser(res.data);
        setSuccessMessage("Profile updated successfully!");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update profile";
      setErrorMessage(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-surface min-h-screen text-on-surface">
      <Topbar
        title="Student Profile & Institutional Information"
        subtitle="Academic Record Details"
      />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto w-full space-y-6 animate-fade-in">
        <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-6 sm:p-8 shadow-sm text-xs space-y-6">
          {/* Header with Avatar */}
          <div className="flex items-center gap-4 pb-5 border-b border-surface-container-high">
            <div className="w-16 h-16 rounded-2xl bg-primary text-on-primary font-bold text-2xl flex items-center justify-center shadow-xs shrink-0">
              {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="min-w-0">
              <h2 className="font-headline-sm text-lg font-bold text-on-surface truncate">
                {user?.name || "Student"}
              </h2>
              <p className="font-label-sm text-outline text-[11px] mt-0.5 truncate">{user?.email}</p>
              <div className="mt-2">
                <span className="font-label-sm text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-primary-fixed text-primary font-bold border border-primary/20">
                  ROLE: {user?.role || "STUDENT"}
                </span>
              </div>
            </div>
          </div>

          {successMessage && (
            <div className="p-3.5 bg-[#ecfdf5] border border-[#a7f3d0] text-[#065f46] rounded-xl font-medium animate-fade-in flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 bg-error-container text-on-error-container border border-error/30 rounded-xl font-medium animate-fade-in flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block font-semibold text-on-surface mb-1.5">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-surface-container-low border border-surface-container-high rounded-xl p-2.5 text-on-surface placeholder:text-outline focus:outline-hidden focus:ring-1 focus:ring-primary font-body-sm"
              />
            </div>

            <div>
              <label className="block font-semibold text-on-surface mb-1.5">
                Institutional Email (Read Only)
              </label>
              <input
                type="email"
                disabled
                value={user?.email || ""}
                className="w-full bg-surface-container border border-surface-container-high rounded-xl p-2.5 text-outline cursor-not-allowed font-label-sm text-[11px]"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-on-surface mb-1.5">
                  Enrollment Number
                </label>
                <input
                  type="text"
                  value={enrollmentNo}
                  onChange={(e) => setEnrollmentNo(e.target.value)}
                  placeholder="e.g. BE-2022-CS-104"
                  className="w-full bg-surface-container-low border border-surface-container-high rounded-xl p-2.5 text-on-surface placeholder:text-outline focus:outline-hidden focus:ring-1 focus:ring-primary font-body-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-on-surface mb-1.5">
                  Academic Department
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full bg-surface-container-low border border-surface-container-high rounded-xl p-2.5 text-on-surface placeholder:text-outline focus:outline-hidden focus:ring-1 focus:ring-primary font-body-sm"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-surface-container-high flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-primary-container hover:opacity-90 disabled:opacity-50 text-on-primary font-semibold shadow-xs cursor-pointer transition-opacity"
              >
                {saving ? "Saving Changes..." : "Save Profile"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
