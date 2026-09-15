"use client";

import React, { useState, useEffect } from "react";
import { apiRequest } from "@/lib/api";
import { AtRiskStudent } from "@/lib/types";
import Topbar from "@/components/layout/Topbar";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";

import SkeletonLoader, { TableSkeleton } from "@/components/ui/SkeletonLoader";

export default function FacultyStudentsPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [atRiskStudents, setAtRiskStudents] = useState<AtRiskStudent[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "at-risk">("at-risk");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStudentData() {
      try {
        setLoading(true);
        const studsRes = await apiRequest<any[]>("/students");
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

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <Topbar title="Student Roster & Risk Diagnostics" subtitle="Cohort Monitoring & Interventions" />

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6 animate-fade-in">
        {/* Tab Toggle */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3.5">
          <div className="flex space-x-2.5">
            <button
              onClick={() => setActiveTab("at-risk")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all btn-press ${
                activeTab === "at-risk"
                  ? "bg-rose-700 text-white shadow-xs"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 shadow-2xs"
              }`}
            >
              ⚠️ At-Risk Diagnostic Alerts ({atRiskStudents.length})
            </button>
            <button
              onClick={() => setActiveTab("all")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all btn-press ${
                activeTab === "all"
                  ? "bg-blue-700 text-white shadow-xs"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 shadow-2xs"
              }`}
            >
              All Enrolled Students ({students.length})
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : activeTab === "at-risk" ? (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
            <div className="pb-3.5 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900">
                At-Risk Academic Alert Table ({atRiskStudents.length})
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Students flagged for early faculty intervention based on quiz performance and syllabus module completion
              </p>
            </div>

            {atRiskStudents.length > 0 ? (
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left academic-table">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                      <th className="pb-2.5 font-bold">Student Name</th>
                      <th className="pb-2.5 font-bold">Enrollment No</th>
                      <th className="pb-2.5 font-bold">Course</th>
                      <th className="pb-2.5 font-bold">Avg Quiz Score</th>
                      <th className="pb-2.5 font-bold">Module Progress</th>
                      <th className="pb-2.5 font-bold">Risk Level</th>
                      <th className="pb-2.5 font-bold">Primary Diagnosis & Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {atRiskStudents.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 font-bold text-slate-900">{s.studentName}</td>
                        <td className="py-3 text-slate-600 font-mono text-[11px]">{s.enrollmentNo}</td>
                        <td className="py-3 font-semibold text-slate-700">{s.courseCode}</td>
                        <td className="py-3 font-bold text-rose-700 font-mono">{s.averageQuizScore}%</td>
                        <td className="py-3 font-semibold text-slate-700 font-mono">{s.courseProgressPercentage}%</td>
                        <td className="py-3">
                          <Badge variant={s.riskLevel === "HIGH" ? "danger" : "warning"}>
                            {s.riskLevel}
                          </Badge>
                        </td>
                        <td className="py-3 text-slate-600 max-w-xs text-[11px] leading-relaxed">{s.recommendedIntervention}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="No At-Risk Students"
                description="All students in your cohort currently meet academic mastery criteria."
              />
            )}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 pb-3.5 border-b border-slate-100 mb-4">
              Department Student Directory ({students.length})
            </h3>

            {students.length > 0 ? (
              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left academic-table">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                      <th className="pb-2.5 font-bold">Name</th>
                      <th className="pb-2.5 font-bold">Institutional Email</th>
                      <th className="pb-2.5 font-bold">Enrollment No</th>
                      <th className="pb-2.5 font-bold">Department</th>
                      <th className="pb-2.5 font-bold">Enrolled Courses</th>
                      <th className="pb-2.5 font-bold">Quizzes Attempted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 font-bold text-slate-900">{s.name}</td>
                        <td className="py-3 text-slate-600 font-mono text-[11px]">{s.email}</td>
                        <td className="py-3 font-mono text-slate-600 text-[11px]">{s.enrollmentNo || "N/A"}</td>
                        <td className="py-3 text-slate-600">{s.department || "Computer Engineering"}</td>
                        <td className="py-3 font-semibold text-blue-700">{s._count?.enrollments || 0}</td>
                        <td className="py-3 font-semibold text-slate-700">{s._count?.quizAttempts || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No Students" description="No students currently registered." />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
