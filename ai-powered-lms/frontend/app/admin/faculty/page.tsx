"use client";

import React, { useState, useEffect } from "react";
import { apiRequest } from "@/lib/api";
import Topbar from "@/components/layout/Topbar";
import EmptyState from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/SkeletonLoader";
import Badge from "@/components/ui/Badge";

interface FacultyRegistryItem {
  id: string;
  name: string;
  email: string;
  employeeId?: string;
  department?: string;
  createdAt: string;
  _count?: {
    coursesInstructed?: number;
  };
}

export default function AdminFacultyPage() {
  const [faculty, setFaculty] = useState<FacultyRegistryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function loadFaculty() {
      try {
        setLoading(true);
        const res = await apiRequest<FacultyRegistryItem[]>("/faculty");
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
    <div className="flex-1 flex flex-col bg-surface min-h-screen text-on-surface">
      <Topbar title="Faculty Academic Directory" subtitle="Department Instructional Staff Roster" />

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
                placeholder="Search faculty name, email, employee ID..."
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
              Showing <strong className="text-on-surface font-mono">{filteredFaculty.length}</strong> of <strong className="text-on-surface font-mono">{faculty.length}</strong> Faculty Members
            </span>
          </div>
        </div>

        {/* Faculty Table */}
        <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3.5 border-b border-outline-variant/30">
            <div>
              <h3 className="text-sm font-bold text-on-surface">Faculty Members ({faculty.length})</h3>
              <p className="text-[11px] text-on-surface-variant mt-0.5">Computer Engineering Department instructional staff</p>
            </div>
            <Badge variant="info">Instructional Corps</Badge>
          </div>

          {loading ? (
            <TableSkeleton rows={6} cols={6} />
          ) : filteredFaculty.length > 0 ? (
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-outline-variant/30 text-outline uppercase text-[10px] tracking-wider font-mono">
                    <th className="pb-2.5 font-bold">Faculty Member</th>
                    <th className="pb-2.5 font-bold">Institutional Email</th>
                    <th className="pb-2.5 font-bold">Employee ID</th>
                    <th className="pb-2.5 font-bold">Department</th>
                    <th className="pb-2.5 font-bold text-center">Instructed Courses</th>
                    <th className="pb-2.5 font-bold">Appointment Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {filteredFaculty.map((f) => (
                    <tr key={f.id} className="hover:bg-surface-container-low/70 transition-colors">
                      <td className="py-3 font-bold text-on-surface">{f.name}</td>
                      <td className="py-3 text-on-surface-variant font-mono text-[11px]">{f.email}</td>
                      <td className="py-3 font-mono text-on-surface text-[11px]">
                        <span className="bg-surface-container-high px-2 py-0.5 rounded border border-outline-variant/40 font-mono">
                          {f.employeeId || "N/A"}
                        </span>
                      </td>
                      <td className="py-3 text-on-surface-variant">{f.department || "Computer Engineering"}</td>
                      <td className="py-3 text-center">
                        <span className="font-mono font-bold text-primary bg-surface-container px-2.5 py-0.5 rounded-full text-[11px]">
                          {f._count?.coursesInstructed || 0} Courses
                        </span>
                      </td>
                      <td className="py-3 text-on-surface-variant font-mono text-[11px]">
                        {new Date(f.createdAt).toLocaleDateString()}
                      </td>
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
