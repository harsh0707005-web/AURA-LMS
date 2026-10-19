"use client";

import React, { useState, useEffect } from "react";
import { apiRequest } from "@/lib/api";
import Topbar from "@/components/layout/Topbar";
import EmptyState from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/SkeletonLoader";
import Badge from "@/components/ui/Badge";

interface StudentRegistryItem {
  id: string;
  name: string;
  email: string;
  enrollmentNo?: string;
  department?: string;
  createdAt: string;
  _count?: {
    enrollments?: number;
    quizAttempts?: number;
  };
}

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<StudentRegistryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function loadStudents() {
      try {
        setLoading(true);
        const res = await apiRequest<StudentRegistryItem[]>("/students");
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
    <div className="flex-1 flex flex-col bg-surface min-h-screen text-on-surface">
      <Topbar title="Student Academic Registry" subtitle="Department Enrolled Student Roster" />

      <main className="flex-1 p-6 sm:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Controls Bar */}
        <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-4.5 sm:p-5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="relative w-80">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                search
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search student name, email, roll no..."
                className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg pl-9 pr-8 py-2 text-xs text-on-surface placeholder:text-outline focus:outline-none focus:border-primary transition-colors"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface text-xs font-bold"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-on-surface-variant font-medium">
              Showing <strong className="text-on-surface font-mono">{filteredStudents.length}</strong> of <strong className="text-on-surface font-mono">{students.length}</strong> Students
            </span>
          </div>
        </div>

        {/* Student Table */}
        <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3.5 border-b border-outline-variant/30">
            <div>
              <h3 className="text-sm font-bold text-on-surface">Enrolled Students ({students.length})</h3>
              <p className="text-[11px] text-on-surface-variant mt-0.5">Computer Engineering Department registry</p>
            </div>
            <Badge variant="neutral">Undergraduate Registry</Badge>
          </div>

          {loading ? (
            <TableSkeleton rows={6} cols={7} />
          ) : filteredStudents.length > 0 ? (
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-outline-variant/30 text-outline uppercase text-[10px] tracking-wider font-mono">
                    <th className="pb-2.5 font-bold">Student Name</th>
                    <th className="pb-2.5 font-bold">Institutional Email</th>
                    <th className="pb-2.5 font-bold">Enrollment No</th>
                    <th className="pb-2.5 font-bold">Department</th>
                    <th className="pb-2.5 font-bold text-center">Active Courses</th>
                    <th className="pb-2.5 font-bold text-center">Quizzes Taken</th>
                    <th className="pb-2.5 font-bold">Registration Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {filteredStudents.map((s) => (
                    <tr key={s.id} className="hover:bg-surface-container-low/70 transition-colors">
                      <td className="py-3 font-bold text-on-surface">{s.name}</td>
                      <td className="py-3 text-on-surface-variant font-mono text-[11px]">{s.email}</td>
                      <td className="py-3 font-mono text-on-surface text-[11px]">
                        <span className="bg-surface-container-high px-2 py-0.5 rounded border border-outline-variant/40 font-mono">
                          {s.enrollmentNo || "N/A"}
                        </span>
                      </td>
                      <td className="py-3 text-on-surface-variant">{s.department || "Computer Engineering"}</td>
                      <td className="py-3 text-center">
                        <span className="font-mono font-bold text-primary bg-surface-container px-2 py-0.5 rounded-full text-[11px]">
                          {s._count?.enrollments || 0}
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <span className="font-mono font-bold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full text-[11px]">
                          {s._count?.quizAttempts || 0}
                        </span>
                      </td>
                      <td className="py-3 text-on-surface-variant font-mono text-[11px]">
                        {new Date(s.createdAt).toLocaleDateString()}
                      </td>
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
