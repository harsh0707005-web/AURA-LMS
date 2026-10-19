"use client";

import React, { useState, useEffect } from "react";
import { apiRequest } from "@/lib/api";
import { AtRiskStudent } from "@/lib/types";
import Topbar from "@/components/layout/Topbar";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/SkeletonLoader";

interface StudentRecord {
  id: string;
  name: string;
  email: string;
  enrollmentNo?: string;
  department?: string;
  _count?: {
    enrollments?: number;
    quizAttempts?: number;
  };
}

export default function FacultyStudentsPage() {
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [atRiskStudents, setAtRiskStudents] = useState<AtRiskStudent[]>([]);
  const [activeTab, setActiveTab] = useState<"at-risk" | "all">("at-risk");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStudentData() {
      try {
        setLoading(true);
        const studsRes = await apiRequest<StudentRecord[]>("/students");
        if (studsRes.success && studsRes.data) setStudents(studsRes.data);

        const riskRes = await apiRequest<AtRiskStudent[]>("/analytics/at-risk");
        if (riskRes.success && riskRes.data) setAtRiskStudents(riskRes.data);
      } catch (err) {
        console.error("Failed to load student records:", err);
      } finally {
        setLoading(false);
      }
    }

    loadStudentData();
  }, []);

  const filteredStudents = students.filter((s) => {
    const q = searchTerm.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      (s.enrollmentNo && s.enrollmentNo.toLowerCase().includes(q))
    );
  });

  const filteredAtRisk = atRiskStudents.filter((s) => {
    const q = searchTerm.toLowerCase();
    return (
      s.studentName.toLowerCase().includes(q) ||
      s.enrollmentNo.toLowerCase().includes(q) ||
      s.courseCode.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 flex flex-col bg-surface min-h-screen text-on-surface">
      <Topbar title="Student Roster & Risk Diagnostics" subtitle="Cohort Monitoring & Interventions" />

      <main className="flex-1 p-6 sm:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Tab & Search Control Bar */}
        <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("at-risk")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                activeTab === "at-risk"
                  ? "bg-error text-on-error shadow-xs"
                  : "bg-surface-container-low text-on-surface hover:bg-surface-container border border-outline-variant/40"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">warning</span>
              <span>At-Risk Diagnostic Alerts ({atRiskStudents.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("all")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                activeTab === "all"
                  ? "bg-primary text-on-primary shadow-xs"
                  : "bg-surface-container-low text-on-surface hover:bg-surface-container border border-outline-variant/40"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">group</span>
              <span>All Enrolled Students ({students.length})</span>
            </button>
          </div>

          <div className="relative w-72">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
              search
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search student or roll no..."
              className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg pl-9 pr-3 py-2 text-xs text-on-surface placeholder:text-outline focus:outline-none focus:border-primary transition-colors"
            />
          </div>
        </div>

        {/* Tab Content */}
        {loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : activeTab === "at-risk" ? (
          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-outline-variant/30 gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-error text-[20px]">troubleshoot</span>
                  <h3 className="text-sm font-bold text-on-surface">
                    At-Risk Academic Alert Table ({filteredAtRisk.length})
                  </h3>
                </div>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  Students flagged for early faculty intervention based on quiz performance and syllabus module completion
                </p>
              </div>
              <Badge variant="danger">{filteredAtRisk.length} Flagged</Badge>
            </div>

            {filteredAtRisk.length > 0 ? (
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-outline-variant/30 text-outline uppercase text-[10px] tracking-wider font-mono">
                      <th className="pb-2.5 font-bold">Student Name</th>
                      <th className="pb-2.5 font-bold">Enrollment No</th>
                      <th className="pb-2.5 font-bold">Course</th>
                      <th className="pb-2.5 font-bold">Avg Quiz Score</th>
                      <th className="pb-2.5 font-bold">Module Progress</th>
                      <th className="pb-2.5 font-bold">Risk Level</th>
                      <th className="pb-2.5 font-bold">Primary Diagnosis & Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    {filteredAtRisk.map((s) => (
                      <tr key={s.id} className="hover:bg-surface-container-low/70 transition-colors">
                        <td className="py-3 font-bold text-on-surface">{s.studentName}</td>
                        <td className="py-3 text-on-surface-variant font-mono text-[11px]">{s.enrollmentNo}</td>
                        <td className="py-3 font-semibold text-on-surface">{s.courseCode}</td>
                        <td className="py-3 font-bold text-error font-mono">{s.averageQuizScore}%</td>
                        <td className="py-3 font-semibold text-on-surface font-mono">{s.courseProgressPercentage}%</td>
                        <td className="py-3">
                          <Badge variant={s.riskLevel === "HIGH" ? "danger" : "warning"}>
                            {s.riskLevel}
                          </Badge>
                        </td>
                        <td className="py-3 text-on-surface-variant max-w-xs text-[11px] leading-relaxed">
                          {s.recommendedIntervention}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="No At-Risk Students"
                description={
                  searchTerm
                    ? "No at-risk students match your search filter."
                    : "All students in your cohort currently meet academic mastery criteria."
                }
              />
            )}
          </div>
        ) : (
          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3.5 border-b border-outline-variant/30">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">groups</span>
                <h3 className="text-sm font-bold text-on-surface">
                  Department Student Directory ({filteredStudents.length})
                </h3>
              </div>
              <span className="font-mono text-[11px] text-outline font-semibold uppercase">Student Registry</span>
            </div>

            {filteredStudents.length > 0 ? (
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-outline-variant/30 text-outline uppercase text-[10px] tracking-wider font-mono">
                      <th className="pb-2.5 font-bold">Name</th>
                      <th className="pb-2.5 font-bold">Institutional Email</th>
                      <th className="pb-2.5 font-bold">Enrollment No</th>
                      <th className="pb-2.5 font-bold">Department</th>
                      <th className="pb-2.5 font-bold text-center">Courses</th>
                      <th className="pb-2.5 font-bold text-center">Quizzes Taken</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    {filteredStudents.map((s) => (
                      <tr key={s.id} className="hover:bg-surface-container-low/70 transition-colors">
                        <td className="py-3 font-bold text-on-surface">{s.name}</td>
                        <td className="py-3 text-on-surface-variant font-mono text-[11px]">{s.email}</td>
                        <td className="py-3 font-mono text-on-surface-variant text-[11px]">{s.enrollmentNo || "N/A"}</td>
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No Students Found" description="No students match your query." />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
