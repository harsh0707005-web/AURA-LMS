"use client";

import React, { useState, useEffect } from "react";
import { apiRequest } from "@/lib/api";
import Topbar from "@/components/layout/Topbar";
import EmptyState from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/SkeletonLoader";
import Badge from "@/components/ui/Badge";

export default function AdminFacultyPage() {
  const [faculty, setFaculty] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function loadFaculty() {
      try {
        setLoading(true);
        const res = await apiRequest<any[]>("/faculty");
        if (res.success && res.data) {
          setFaculty(res.data);
        }
      } catch (err) {
        console.error("Failed to load faculty directory:", err);
      } finally {
        setLoading(false);
      }
    }

    loadFaculty();
  }, []);

  const filteredFaculty = faculty.filter((f) => {
    const q = searchTerm.toLowerCase();
    return (
      f.name?.toLowerCase().includes(q) ||
      f.email?.toLowerCase().includes(q) ||
      f.employeeId?.toLowerCase().includes(q) ||
      f.department?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <Topbar title="Faculty Academic Directory" subtitle="Department Instructional Staff Roster" />

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6 animate-fade-in">
        {/* Controls Bar */}
        <div className="bg-white border border-slate-200 rounded-xl p-4.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by faculty name, email, employee ID..."
                className="bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-xs text-slate-900 w-80 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors shadow-2xs"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 font-medium">
              Showing <strong className="text-slate-900 font-mono">{filteredFaculty.length}</strong> of <strong className="text-slate-900 font-mono">{faculty.length}</strong> Faculty Members
            </span>
          </div>
        </div>

        {/* Faculty Table */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Faculty Members ({faculty.length})</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Computer Engineering Department instructional staff</p>
            </div>
            <Badge variant="info">Instructional Corps</Badge>
          </div>

          {loading ? (
            <TableSkeleton rows={6} cols={6} />
          ) : filteredFaculty.length > 0 ? (
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left academic-table">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                    <th className="pb-2.5 font-bold">Faculty Member</th>
                    <th className="pb-2.5 font-bold">Institutional Email</th>
                    <th className="pb-2.5 font-bold">Employee ID</th>
                    <th className="pb-2.5 font-bold">Department</th>
                    <th className="pb-2.5 font-bold text-center">Instructed Courses</th>
                    <th className="pb-2.5 font-bold">Appointment Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredFaculty.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 font-bold text-slate-900">{f.name}</td>
                      <td className="py-3 text-slate-600 font-mono text-[11px]">{f.email}</td>
                      <td className="py-3 font-mono text-slate-700 text-[11px]">
                        <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {f.employeeId || "N/A"}
                        </span>
                      </td>
                      <td className="py-3 text-slate-600">{f.department || "Computer Engineering"}</td>
                      <td className="py-3 text-center">
                        <span className="font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                          {f._count?.coursesInstructed || 0} Courses
                        </span>
                      </td>
                      <td className="py-3 text-slate-500">{new Date(f.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No Faculty Members Found" description="No faculty match your search criteria." />
          )}
        </div>
      </main>
    </div>
  );
}
