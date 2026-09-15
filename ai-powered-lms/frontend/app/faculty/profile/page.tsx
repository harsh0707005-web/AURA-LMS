"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { apiRequest } from "@/lib/api";
import Topbar from "@/components/layout/Topbar";

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
      const res = await apiRequest("/profile", {
        method: "PUT",
        body: JSON.stringify({ name, department, employeeId }),
      });

      if (res.success && res.data) {
        updateUser(res.data);
        setSuccessMessage("Faculty profile updated successfully!");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <Topbar title="Faculty Member Profile" subtitle="Academic Staff Credentials" />

      <main className="flex-1 p-6 max-w-3xl mx-auto w-full space-y-6 animate-fade-in">
        <div className="bg-white border border-slate-200 rounded-2xl p-7 shadow-xs text-xs space-y-6">
          <div className="flex items-center space-x-4 pb-5 border-b border-slate-100">
            <div className="h-16 w-16 rounded-2xl bg-blue-700 text-white font-bold text-xl flex items-center justify-center shadow-xs">
              {user?.name ? user.name.charAt(0).toUpperCase() : "F"}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{user?.name || "Faculty"}</h2>
              <p className="text-slate-500 font-mono text-[11px] mt-0.5">{user?.email}</p>
              <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 text-[10px] font-bold border border-blue-200 font-mono">
                ROLE: {user?.role}
              </span>
            </div>
          </div>

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-medium animate-fade-in">
              ✓ {successMessage}
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl font-medium animate-fade-in">
              ⚠️ {errorMessage}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Full Name & Title</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs transition-colors"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Institutional Email (Read Only)</label>
              <input
                type="email"
                disabled
                value={user?.email || ""}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-500 cursor-not-allowed font-mono text-[11px]"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Faculty Employee ID</label>
                <input
                  type="text"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs font-mono uppercase transition-colors"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Department</label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs transition-colors"
                />
              </div>
            </div>

            <div className="pt-3.5 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-blue-700 hover:bg-blue-800 active:scale-95 text-white font-semibold rounded-lg shadow-xs transition-all cursor-pointer btn-press"
              >
                {saving ? "Saving Changes..." : "Update Profile"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
