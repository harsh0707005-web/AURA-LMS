"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { UserRole } from "@/lib/types";

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const STUDENT_GROUPS: NavGroup[] = [
  {
    title: "CORE",
    items: [
      { label: "Dashboard", href: "/student/dashboard", icon: "dashboard" },
      { label: "My Courses", href: "/student/courses", icon: "school" },
      { label: "Materials", href: "/student/materials", icon: "menu_book" },
    ],
  },
  {
    title: "AI LEARNING",
    items: [
      { label: "AI Course Tutor", href: "/student/ai-tutor", icon: "smart_toy" },
      { label: "Recommendations", href: "/student/recommendations", icon: "auto_awesome" },
    ],
  },
  {
    title: "ASSESSMENTS",
    items: [
      { label: "Quizzes", href: "/student/quizzes", icon: "quiz" },
      { label: "Assignments", href: "/student/assignments", icon: "assignment" },
      { label: "Performance", href: "/student/performance", icon: "insights" },
    ],
  },
  {
    title: "ACCOUNT",
    items: [
      { label: "My Profile", href: "/student/profile", icon: "account_circle" },
    ],
  },
];

const FACULTY_GROUPS: NavGroup[] = [
  {
    title: "CORE",
    items: [
      { label: "Dashboard", href: "/faculty/dashboard", icon: "dashboard" },
      { label: "Courses Management", href: "/faculty/courses", icon: "school" },
      { label: "Course Materials", href: "/faculty/materials", icon: "menu_book" },
    ],
  },
  {
    title: "ASSESSMENTS & GRADING",
    items: [
      { label: "Quizzes & Tests", href: "/faculty/quizzes", icon: "quiz" },
      { label: "Assignments & Grading", href: "/faculty/assignments", icon: "assignment" },
    ],
  },
  {
    title: "COHORT & ANALYTICS",
    items: [
      { label: "Student Roster & Risk", href: "/faculty/students", icon: "groups" },
      { label: "Academic Analytics", href: "/faculty/analytics", icon: "insights" },
    ],
  },
  {
    title: "ACCOUNT",
    items: [
      { label: "Faculty Profile", href: "/faculty/profile", icon: "account_circle" },
    ],
  },
];

const ADMIN_GROUPS: NavGroup[] = [
  {
    title: "SYSTEM",
    items: [
      { label: "System Console", href: "/admin/dashboard", icon: "dashboard" },
    ],
  },
  {
    title: "DIRECTORIES",
    items: [
      { label: "User Accounts", href: "/admin/users", icon: "manage_accounts" },
      { label: "Student Directory", href: "/admin/students", icon: "groups" },
      { label: "Student Registry Import", href: "/admin/student-registry", icon: "upload_file" },
      { label: "Faculty Directory", href: "/admin/faculty", icon: "badge" },
      { label: "Faculty Applications", href: "/admin/faculty-applications", icon: "how_to_reg" },
      { label: "Course Catalog", href: "/admin/courses", icon: "library_books" },
    ],
  },
];

interface SidebarProps {
  role: UserRole;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  isCollapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export default function Sidebar({
  role,
  isMobileOpen = false,
  onCloseMobile,
  isCollapsed = false,
  onToggleCollapsed,
}: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const mobilePanelRef = useRef<HTMLElement>(null);

  // Close mobile drawer on Escape key
  useEffect(() => {
    if (!isMobileOpen || !onCloseMobile) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseMobile();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileOpen, onCloseMobile]);

  // Keep keyboard focus inside the mobile navigation while it is open and
  // return focus to the menu trigger when the drawer closes.
  useEffect(() => {
    if (!isMobileOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = mobilePanelRef.current;
    const focusableSelector =
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusable = panel
      ? Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector))
      : [];

    focusable[0]?.focus();
    document.body.style.overflow = "hidden";

    const handleTab = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleTab);
    return () => {
      document.removeEventListener("keydown", handleTab);
      document.body.style.overflow = "";
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [isMobileOpen]);

  const navGroups =
    role === "ADMIN" ? ADMIN_GROUPS : role === "FACULTY" ? FACULTY_GROUPS : STUDENT_GROUPS;

  const roleLabel =
    role === "ADMIN"
      ? "Admin Console"
      : role === "FACULTY"
      ? "Faculty Portal"
      : "Student Workspace";

  const renderNavContent = (isMobileView: boolean) => {
    const showCompact = !isMobileView && isCollapsed;

    return (
      <aside
        ref={isMobileView ? mobilePanelRef : undefined}
        className={`${
          showCompact ? "w-20" : "w-64"
        } bg-surface-container-low border-r border-surface-container-high flex flex-col h-screen select-none z-30 transition-[width] duration-200`}
        aria-label="Sidebar Navigation"
      >
        {/* Brand Header */}
        <div className="h-16 px-4 border-b border-surface-container-high flex items-center justify-between shrink-0">
          <Link
            href="/"
            onClick={onCloseMobile}
            className={`flex items-center gap-3 group focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden rounded-lg p-1 ${
              showCompact ? "mx-auto justify-center" : ""
            }`}
            title="AURA LMS Platform"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-primary-container flex items-center justify-center text-on-primary shadow-xs group-hover:opacity-90 transition-opacity shrink-0">
              <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
            </div>
            {!showCompact && (
              <div className="flex flex-col">
                <span className="font-headline-sm text-headline-sm font-bold tracking-tight text-on-surface leading-none">
                  AURA
                </span>
                <span className="font-label-sm text-[10px] uppercase tracking-wider text-outline leading-tight mt-0.5">
                  LMS Platform
                </span>
              </div>
            )}
          </Link>

          {isMobileView && onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
              aria-label="Close navigation sidebar"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          )}
        </div>

        {/* Role Indicator Banner */}
        {!showCompact && (
          <div className="px-4 py-2 bg-surface-container/60 border-b border-surface-container-high flex items-center justify-between shrink-0">
            <span className="font-label-sm text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              {roleLabel}
            </span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary" />
            </span>
          </div>
        )}

        {/* Grouped Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              {!showCompact ? (
                <div className="px-3 pt-1 pb-0.5">
                  <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">
                    {group.title}
                  </span>
                </div>
              ) : (
                <div className="border-t border-surface-container-high my-2 mx-2" />
              )}

              {group.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== `/${role.toLowerCase()}/dashboard` &&
                    pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onCloseMobile}
                    aria-current={isActive ? "page" : undefined}
                    title={showCompact ? item.label : undefined}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-body-sm font-medium transition-colors ${
                      showCompact ? "justify-center px-2" : ""
                    } ${
                      isActive
                        ? "bg-primary-container text-on-primary font-semibold shadow-xs"
                        : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                    } focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden`}
                  >
                    <span
                      className={`material-symbols-outlined text-[19px] shrink-0 ${
                        isActive ? "text-on-primary" : "text-outline"
                      }`}
                    >
                      {item.icon}
                    </span>
                    {!showCompact && (
                      <span className="truncate flex-1 leading-tight">{item.label}</span>
                    )}
                    {!showCompact && isActive && (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-secondary-fixed shrink-0"
                        aria-hidden="true"
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User Session Footer Card */}
        <div className="p-3 border-t border-surface-container-high bg-surface-container/40 shrink-0">
          {!showCompact ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-xs shrink-0 shadow-xs">
                  {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-on-surface truncate leading-tight">
                    {user?.name || "Academic User"}
                  </div>
                  <div className="font-label-sm text-[10px] text-outline truncate leading-tight">
                    {user?.email || "user@college.edu"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={logout}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-medium text-on-surface-variant hover:text-error hover:bg-error-container/40 border border-surface-container-high transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-error focus-visible:outline-hidden"
                  aria-label="Sign out of current account"
                >
                  <span className="material-symbols-outlined text-[16px]">logout</span>
                  <span>Sign Out</span>
                </button>

                {onToggleCollapsed && (
                  <button
                    type="button"
                    onClick={onToggleCollapsed}
                    className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container border border-surface-container-high transition-colors cursor-pointer"
                    aria-label="Collapse sidebar"
                    title="Collapse sidebar"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      keyboard_double_arrow_left
                    </span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-xs shadow-xs"
                title={user?.name || "Academic User"}
              >
                {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
              </div>
              <button
                type="button"
                onClick={logout}
                className="p-1.5 rounded-lg text-outline hover:text-error hover:bg-error-container/40 transition-colors cursor-pointer"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
              </button>
              {onToggleCollapsed && (
                <button
                  type="button"
                  onClick={onToggleCollapsed}
                  className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
                  title="Expand sidebar"
                  aria-label="Expand sidebar"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    keyboard_double_arrow_right
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      </aside>
    );
  };

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <div className="hidden md:block sticky top-0 h-screen shrink-0">
        {renderNavContent(false)}
      </div>

      {/* Mobile Off-Canvas Drawer with Backdrop */}
      {isMobileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation"
          id="mobile-navigation-drawer"
          className="fixed inset-0 z-50 md:hidden flex animate-fade-in"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          {/* Drawer Sheet */}
          <div className="relative z-50 animate-slide-up h-full">
            {renderNavContent(true)}
          </div>
        </div>
      )}
    </>
  );
}
