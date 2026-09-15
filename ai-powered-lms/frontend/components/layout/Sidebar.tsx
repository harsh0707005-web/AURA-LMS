"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { UserRole } from "@/lib/types";

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const STUDENT_NAV: NavItem[] = [
  { label: "Dashboard", href: "/student/dashboard", icon: "📊" },
  { label: "My Courses", href: "/student/courses", icon: "📚" },
  { label: "Materials", href: "/student/materials", icon: "📄" },
  { label: "Assignments", href: "/student/assignments", icon: "📝" },
  { label: "Quizzes", href: "/student/quizzes", icon: "⏱️" },
  { label: "Performance", href: "/student/performance", icon: "📈" },
  { label: "Recommendations", href: "/student/recommendations", icon: "🎯" },
  { label: "AI Course Tutor", href: "/student/ai-tutor", icon: "💡" },
  { label: "My Profile", href: "/student/profile", icon: "👤" },
];

const FACULTY_NAV: NavItem[] = [
  { label: "Dashboard", href: "/faculty/dashboard", icon: "📊" },
  { label: "Courses Management", href: "/faculty/courses", icon: "📚" },
  { label: "Course Materials", href: "/faculty/materials", icon: "📄" },
  { label: "Assignments & Grading", href: "/faculty/assignments", icon: "📝" },
  { label: "Quizzes & Tests", href: "/faculty/quizzes", icon: "⏱️" },
  { label: "Student Roster & Risk", href: "/faculty/students", icon: "👥" },
  { label: "Academic Analytics", href: "/faculty/analytics", icon: "📈" },
  { label: "Faculty Profile", href: "/faculty/profile", icon: "👤" },
];

const ADMIN_NAV: NavItem[] = [
  { label: "System Console", href: "/admin/dashboard", icon: "🛡️" },
  { label: "User Accounts", href: "/admin/users", icon: "👥" },
  { label: "Student Directory", href: "/admin/students", icon: "🎓" },
  { label: "Faculty Directory", href: "/admin/faculty", icon: "👨‍🏫" },
  { label: "Course Catalog", href: "/admin/courses", icon: "📚" },
];

interface SidebarProps {
  role: UserRole;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({ role, isMobileOpen = false, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const navItems =
    role === "ADMIN" ? ADMIN_NAV : role === "FACULTY" ? FACULTY_NAV : STUDENT_NAV;

  const roleLabel =
    role === "ADMIN" ? "Admin Console" : role === "FACULTY" ? "Faculty Portal" : "Student Workspace";

  const sidebarContent = (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen select-none z-30">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <Link
          href="/"
          onClick={onCloseMobile}
          className="flex items-center space-x-2.5 group"
        >
          <div className="h-8 w-8 rounded-lg bg-blue-700 flex items-center justify-center text-white font-bold text-sm shadow-xs group-hover:bg-blue-800 transition-colors">
            A
          </div>
          <div>
            <div className="font-bold text-slate-900 text-base leading-tight tracking-tight font-sans">
              AURA <span className="text-blue-700 font-semibold text-xs">LMS</span>
            </div>
            <div className="text-[10px] text-slate-500 font-medium">
              University Academic System
            </div>
          </div>
        </Link>

        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            aria-label="Close sidebar"
          >
            ✕
          </button>
        )}
      </div>

      {/* Role Indicator Banner */}
      <div className="px-4 py-2 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 font-mono">
          {roleLabel}
        </span>
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== `/${role.toLowerCase()}/dashboard` && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onCloseMobile}
              className={`flex items-center space-x-3 px-3 py-2 rounded-md text-xs font-medium nav-item-transition ${
                isActive
                  ? "bg-blue-50 text-blue-900 font-semibold border-l-3 border-blue-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-l-3 border-transparent"
              }`}
            >
              <span className="text-sm shrink-0">{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Session Footer */}
      <div className="p-3 border-t border-slate-200 bg-slate-50/50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2.5 overflow-hidden">
            <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-xs shrink-0">
              {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="truncate">
              <div className="text-xs font-semibold text-slate-900 truncate">
                {user?.name || "Academic User"}
              </div>
              <div className="text-[10px] text-slate-500 truncate font-mono">
                {user?.email || "user@college.edu"}
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          className="btn-press w-full mt-1 flex items-center justify-center space-x-1.5 py-1.5 px-3 rounded-md text-xs font-medium text-slate-600 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 transition-colors cursor-pointer"
        >
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <div className="hidden md:block sticky top-0 h-screen shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile Off-Canvas Drawer with Backdrop */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex animate-fade-in">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative z-50 animate-slide-up">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
