"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { apiRequest, checkBackendHealth } from "@/lib/api";
import { User, Course } from "@/lib/types";
import Topbar from "@/components/layout/Topbar";
import StatCard from "@/components/ui/StatCard";
import Badge from "@/components/ui/Badge";
import { StatRowSkeleton, TableSkeleton } from "@/components/ui/SkeletonLoader";

interface HealthStats {
  totalUsers?: number;
  totalCourses?: number;
  totalEnrollments?: number;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [dbStats, setDbStats] = useState<HealthStats | null>(null);
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
    <div className="flex-1 flex flex-col bg-surface min-h-screen text-on-surface">
      <Topbar
        title="Institutional Administration Console"
        subtitle={`System Administrator • ${user?.name || "Administrator"}`}
      />

      <main className="flex-1 p-6 sm:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* KPI Grid */}
        {loading ? (
          <StatRowSkeleton count={4} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Registered Users"
              value={users.length}
              subtitle={`${studentsCount} Students • ${facultyCount} Faculty`}
              icon="groups"
            />
            <StatCard
              title="Academic Courses"
              value={courses.length}
              subtitle="Department Offerings"
              icon="school"
            />
            <StatCard
              title="Database Records"
              value={dbStats?.totalUsers ? `${dbStats.totalUsers} Accounts` : `${users.length} Active`}
              subtitle="PostgreSQL Verified"
              icon="database"
            />
            <StatCard
              title="Security Status"
              value="Enforced"
              subtitle="RBAC & Fail-Fast JWT"
              icon="security"
            />
          </div>
        )}

        {/* Console Shortcuts */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { title: "User Directory", count: `${users.length} Users (${adminCount} Admins)`, href: "/admin/users", icon: "manage_accounts" },
            { title: "Student Roster", count: `${studentsCount} Students`, href: "/admin/students", icon: "school" },
            { title: "Faculty Applications", count: "Review approval queue", href: "/admin/faculty-applications", icon: "how_to_reg" },
            { title: "Faculty Registry", count: `${facultyCount} Faculty`, href: "/admin/faculty", icon: "badge" },
            { title: "Student Registry", count: "Import approved IDs", href: "/admin/student-registry", icon: "upload_file" },
            { title: "Course Catalog", count: `${courses.length} Courses`, href: "/admin/courses", icon: "menu_book" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-5 shadow-xs flex items-center justify-between hover:border-primary/40 hover:shadow-sm transition-all"
            >
              <div>
                <h4 className="text-xs font-bold text-on-surface">{item.title}</h4>
                <p className="text-[11px] text-on-surface-variant font-medium mt-0.5">{item.count}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-surface-container-high text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
              </div>
            </Link>
          ))}
        </div>

        {/* Registered Institutional Accounts Table */}
        {loading ? (
          <TableSkeleton rows={5} cols={6} />
        ) : (
          <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3.5 border-b border-outline-variant/30">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">account_box</span>
                <h3 className="text-sm font-bold text-on-surface">Registered Institutional Accounts</h3>
              </div>
              <Link
                href="/admin/users"
                className="text-xs font-semibold text-primary hover:text-primary-container transition-colors flex items-center gap-1"
              >
                <span>Manage All Accounts</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </Link>
            </div>

            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-outline-variant/30 text-outline uppercase text-[10px] tracking-wider font-mono">
                    <th className="pb-2.5 font-bold">User Name</th>
                    <th className="pb-2.5 font-bold">Email</th>
                    <th className="pb-2.5 font-bold">Role</th>
                    <th className="pb-2.5 font-bold">Department</th>
                    <th className="pb-2.5 font-bold">Identifier</th>
                    <th className="pb-2.5 font-bold">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {users.slice(0, 10).map((u) => (
                    <tr key={u.id} className="hover:bg-surface-container-low/70 transition-colors">
                      <td className="py-3 font-bold text-on-surface">{u.name}</td>
                      <td className="py-3 text-on-surface-variant font-mono text-[11px]">{u.email}</td>
                      <td className="py-3">
                        <Badge
                          variant={
                            u.role === "ADMIN" ? "danger" : u.role === "FACULTY" ? "info" : "default"
                          }
                        >
                          {u.role}
                        </Badge>
                      </td>
                      <td className="py-3 text-on-surface-variant">{u.department || "Computer Engineering"}</td>
                      <td className="py-3 font-mono text-on-surface-variant text-[11px]">
                        {u.enrollmentNo || u.employeeId || "SYS-ADMIN"}
                      </td>
                      <td className="py-3 text-on-surface-variant font-mono text-[11px]">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
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
