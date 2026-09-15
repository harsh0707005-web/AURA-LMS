"use client";

import React, { useState, useEffect } from "react";
import { apiRequest } from "@/lib/api";
import Topbar from "@/components/layout/Topbar";
import EmptyState from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/SkeletonLoader";
import Badge from "@/components/ui/Badge";

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function loadStudents() {
      try {
        setLoading(true);
        const res = await apiRequest<any[]>("/students");
        if (res.success && res.data) {
          setStudents(res.data);
        }
      } catch (err) {
        console.error("Failed to load students:", err);
      } finally {
        setLoading(false);
      }
    }

    loadStudents();
  }, []);

  const filteredStudents = students.filter((s) => {
    const q = searchTerm.toLowerCase();
    return (
      s.name?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      s.enrollmentNo?.toLowerCase().includes(q) ||
      s.department?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <Topbar title="Student Academic Registry" subtitle="Department Enrolled Student Roster" />

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6 animate-fade-in">
        {/* Controls Bar */}
        <div className="bg-white border border-slate-200 rounded-xl p-4.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by student name, email, roll no..."
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
              Showing <strong className="text-slate-900 font-mono">{filteredStudents.length}</strong> of <strong className="text-slate-900 font-mono">{students.length}</strong> Students
            </span>
          </div>
        </div>

        {/* Student Table */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Enrolled Students ({students.length})</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Computer Engineering Department registry</p>
            </div>
            <Badge variant="neutral">Undergraduate Registry</Badge>
          </div>

          {loading ? (
            <TableSkeleton rows={6} cols={7} />
          ) : filteredStudents.length > 0 ? (
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left academic-table">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                    <th className="pb-2.5 font-bold">Student Name</th>
                    <th className="pb-2.5 font-bold">Institutional Email</th>
                    <th className="pb-2.5 font-bold">Enrollment No</th>
                    <th className="pb-2.5 font-bold">Department</th>
                    <th className="pb-2.5 font-bold text-center">Active Courses</th>
                    <th className="pb-2.5 font-bold text-center">Quizzes Taken</th>
                    <th className="pb-2.5 font-bold">Registration Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 font-bold text-slate-900">{s.name}</td>
                      <td className="py-3 text-slate-600 font-mono text-[11px]">{s.email}</td>
                      <td className="py-3 font-mono text-slate-700 text-[11px]">
                        <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {s.enrollmentNo || "N/A"}
                        </span>
                      </td>
                      <td className="py-3 text-slate-600">{s.department || "Computer Engineering"}</td>
                      <td className="py-3 text-center">
                        <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                          {s._count?.enrollments || 0}
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                          {s._count?.quizAttempts || 0}
                        </span>
                      </td>
                      <td className="py-3 text-slate-500">{new Date(s.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No Students Found" description="No students match your search criteria." />
          )}
        </div>
      </main>
    </div>
  );
}
