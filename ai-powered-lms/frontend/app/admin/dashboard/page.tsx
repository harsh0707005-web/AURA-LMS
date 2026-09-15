"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { apiRequest, checkBackendHealth } from "@/lib/api";
import { User, Course } from "@/lib/types";
import Topbar from "@/components/layout/Topbar";
import StatCard from "@/components/ui/StatCard";
import Badge from "@/components/ui/Badge";

import SkeletonLoader, { StatRowSkeleton, TableSkeleton } from "@/components/ui/SkeletonLoader";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [dbStats, setDbStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAdminData() {
      try {
        setLoading(true);
        const [usersRes, coursesRes, healthRes] = await Promise.all([
          apiRequest<User[]>("/users"),
          apiRequest<Course[]>("/courses"),
          checkBackendHealth(),
        ]);

        if (usersRes.success && usersRes.data) setUsers(usersRes.data);
        if (coursesRes.success && coursesRes.data) setCourses(coursesRes.data);
        if (healthRes.success && healthRes.stats) setDbStats(healthRes.stats);
      } catch (err) {
        console.error("Failed to load admin data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadAdminData();
  }, []);

  const studentsCount = users.filter((u) => u.role === "STUDENT").length;
  const facultyCount = users.filter((u) => u.role === "FACULTY").length;
  const adminCount = users.filter((u) => u.role === "ADMIN").length;

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
      <Topbar
        title="Institutional Administration Console"
        subtitle={`System Administrator • ${user?.name || "Administrator"}`}
      />

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6 animate-fade-in">
        {/* KPI Grid */}
        {loading ? (
          <StatRowSkeleton count={4} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Registered Users"
              value={users.length}
              subtitle={`${studentsCount} Students • ${facultyCount} Faculty`}
              icon="👥"
            />
            <StatCard
              title="Active Academic Courses"
              value={courses.length}
              subtitle="Department of CE"
              icon="📚"
            />
            <StatCard
              title="Database Records"
              value={dbStats?.totalUsers ? `${dbStats.totalUsers} Accounts` : `${users.length} Active`}
              subtitle="PostgreSQL 18"
              icon="🗄️"
            />
            <StatCard
              title="System Security Status"
              value="Enforced"
              subtitle="RBAC & Fail-Fast JWT"
              icon="🛡️"
            />
          </div>
        )}

        {/* Console Shortcuts */}
        <div className="grid md:grid-cols-4 gap-4">
          {[
            { title: "User Directory", count: `${users.length} Users`, href: "/admin/users", icon: "👥" },
            { title: "Student Roster", count: `${studentsCount} Students`, href: "/admin/students", icon: "🎓" },
            { title: "Faculty Registry", count: `${facultyCount} Faculty`, href: "/admin/faculty", icon: "👨‍🏫" },
            { title: "Course Catalog", count: `${courses.length} Courses`, href: "/admin/courses", icon: "📚" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="bg-white border border-slate-200 rounded-xl p-4.5 shadow-xs card-interactive flex items-center justify-between transition-all"
            >
              <div>
                <h4 className="text-xs font-bold text-slate-900">{item.title}</h4>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">{item.count}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-xl shrink-0">
                {item.icon}
              </div>
            </Link>
          ))}
        </div>

        {/* Recent Registered Users Table */}
        {loading ? (
          <TableSkeleton rows={5} cols={6} />
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900">Registered Institutional Accounts</h3>
              <Link href="/admin/users" className="text-xs font-semibold text-blue-700 hover:text-blue-900 transition-colors">
                Manage All Accounts →
              </Link>
            </div>

            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left academic-table">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                    <th className="pb-2.5 font-bold">User Name</th>
                    <th className="pb-2.5 font-bold">Email</th>
                    <th className="pb-2.5 font-bold">Role</th>
                    <th className="pb-2.5 font-bold">Department</th>
                    <th className="pb-2.5 font-bold">Identifier</th>
                    <th className="pb-2.5 font-bold">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 font-bold text-slate-900">{u.name}</td>
                      <td className="py-3 text-slate-600 font-mono text-[11px]">{u.email}</td>
                      <td className="py-3">
                        <Badge
                          variant={
                            u.role === "ADMIN" ? "danger" : u.role === "FACULTY" ? "info" : "default"
                          }
                        >
                          {u.role}
                        </Badge>
                      </td>
                      <td className="py-3 text-slate-600">{u.department || "Computer Engineering"}</td>
                      <td className="py-3 font-mono text-slate-600 text-[11px]">
                        {u.enrollmentNo || u.employeeId || "SYS-ADMIN"}
                      </td>
                      <td className="py-3 text-slate-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
