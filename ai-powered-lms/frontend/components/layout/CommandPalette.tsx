"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { UserRole } from "@/lib/types";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  href?: string;
  action?: () => void;
  icon: string;
  category: "Navigation" | "AI Features" | "Assessments" | "Cohort" | "Directory" | "Account" | "Actions";
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const role: UserRole = user?.role || "STUDENT";

  const allItems: CommandItem[] = useMemo(() => {
    const items: CommandItem[] = [];

    if (role === "STUDENT") {
      items.push(
        { id: "s-dash", label: "Dashboard", description: "Overview of courses, metrics and tasks", href: "/student/dashboard", icon: "dashboard", category: "Navigation" },
        { id: "s-courses", label: "My Courses", description: "Enrolled courses and modules", href: "/student/courses", icon: "school", category: "Navigation" },
        { id: "s-materials", label: "Course Materials", description: "Lecture notes and syllabus documents", href: "/student/materials", icon: "menu_book", category: "Navigation" },
        { id: "s-tutor", label: "AI Course Tutor", description: "Ask questions grounded in syllabus PDFs", href: "/student/ai-tutor", icon: "smart_toy", category: "AI Features" },
        { id: "s-recs", label: "AI Recommendations", description: "Weak topic remediation & study plan", href: "/student/recommendations", icon: "auto_awesome", category: "AI Features" },
        { id: "s-quizzes", label: "Topic Quizzes", description: "Interactive assessments and test runs", href: "/student/quizzes", icon: "quiz", category: "Assessments" },
        { id: "s-assign", label: "Assignments", description: "Problem sets and submissions", href: "/student/assignments", icon: "assignment", category: "Assessments" },
        { id: "s-perf", label: "Academic Performance", description: "Mastery metrics and grade diagnostics", href: "/student/performance", icon: "insights", category: "Assessments" },
        { id: "s-profile", label: "Student Profile", description: "Academic record and credentials", href: "/student/profile", icon: "account_circle", category: "Account" }
      );
    } else if (role === "FACULTY") {
      items.push(
        { id: "f-dash", label: "Faculty Dashboard", description: "Instructional console and metrics", href: "/faculty/dashboard", icon: "dashboard", category: "Navigation" },
        { id: "f-courses", label: "Courses Management", description: "Course offerings and syllabus", href: "/faculty/courses", icon: "school", category: "Navigation" },
        { id: "f-materials", label: "Course Materials", description: "Lecture repository and RAG indexing", href: "/faculty/materials", icon: "menu_book", category: "Navigation" },
        { id: "f-quizzes", label: "Quizzes & Tests", description: "Create and publish topic quizzes", href: "/faculty/quizzes", icon: "quiz", category: "Assessments" },
        { id: "f-assign", label: "Assignments & Grading", description: "Assignment submissions and evaluations", href: "/faculty/assignments", icon: "assignment", category: "Assessments" },
        { id: "f-students", label: "Student Roster & Risk", description: "Cohort monitoring and interventions", href: "/faculty/students", icon: "groups", category: "Cohort" },
        { id: "f-analytics", label: "Academic Analytics", description: "Cohort progression and outcome data", href: "/faculty/analytics", icon: "insights", category: "Cohort" },
        { id: "f-profile", label: "Faculty Profile", description: "Academic staff credentials", href: "/faculty/profile", icon: "account_circle", category: "Account" }
      );
    } else if (role === "ADMIN") {
      items.push(
        { id: "a-dash", label: "System Console", description: "Platform health and high-level stats", href: "/admin/dashboard", icon: "dashboard", category: "Navigation" },
        { id: "a-users", label: "User Accounts", description: "Manage university accounts and roles", href: "/admin/users", icon: "manage_accounts", category: "Directory" },
        { id: "a-students", label: "Student Directory", description: "Full student enrollment registry", href: "/admin/students", icon: "groups", category: "Directory" },
        { id: "a-faculty", label: "Faculty Directory", description: "Academic instructors registry", href: "/admin/faculty", icon: "badge", category: "Directory" },
        { id: "a-courses", label: "Course Catalog", description: "Institutional course registry", href: "/admin/courses", icon: "library_books", category: "Directory" }
      );
    }

    // Common actions
    items.push({
      id: "act-logout",
      label: "Sign Out",
      description: "Terminate current authenticated session",
      action: () => logout(),
      icon: "logout",
      category: "Actions",
    });

    return items;
  }, [role, logout]);

  const filteredItems = useMemo(() => {
    if (!query.trim()) return allItems;
    const q = query.toLowerCase();
    return allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [allItems, query]);

  const executeItem = React.useCallback(
    (item: CommandItem) => {
      onClose();
      if (item.action) {
        item.action();
      } else if (item.href) {
        router.push(item.href);
      }
    },
    [onClose, router]
  );

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!isOpen) return;

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = filteredItems[selectedIndex];
        if (selected) {
          executeItem(selected);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, executeItem, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command search palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-inverse-surface/40 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-surface-container-lowest border border-surface-container-high rounded-2xl shadow-xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-surface-container-high bg-surface-container-lowest">
          <span className="material-symbols-outlined text-outline text-[20px]">search</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search navigation, tools, actions..."
            className="flex-1 bg-transparent text-on-surface placeholder:text-outline font-body-md text-body-md outline-hidden border-none"
            aria-label="Search command prompt"
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                setSelectedIndex(0);
              }}
              className="p-1 rounded-md text-outline hover:text-on-surface hover:bg-surface-container-low transition-colors"
              aria-label="Clear query"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
          <kbd className="px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-label-sm text-[10px] border border-surface-container-highest">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-[28px] text-outline block mb-1">
                search_off
              </span>
              <p className="font-body-sm text-body-sm">No results found for &ldquo;{query}&rdquo;</p>
              <p className="font-label-sm text-[11px] text-outline mt-0.5">
                Try searching for a page name like Dashboard, Quizzes, or Materials.
              </p>
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => executeItem(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-primary-container text-on-primary font-semibold shadow-xs"
                      : "text-on-surface hover:bg-surface-container-low"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`material-symbols-outlined text-[20px] shrink-0 ${
                        isSelected ? "text-on-primary" : "text-primary"
                      }`}
                    >
                      {item.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="text-body-sm font-semibold truncate leading-tight">
                        {item.label}
                      </div>
                      {item.description && (
                        <div
                          className={`text-[11px] truncate leading-tight mt-0.5 ${
                            isSelected ? "text-on-primary/80" : "text-on-surface-variant"
                          }`}
                        >
                          {item.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <span
                    className={`font-label-sm text-[10px] uppercase tracking-wider px-2 py-0.5 rounded shrink-0 ml-2 ${
                      isSelected
                        ? "bg-on-primary/20 text-on-primary"
                        : "bg-surface-container-high text-on-surface-variant"
                    }`}
                  >
                    {item.category}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-surface-container-low border-t border-surface-container-high font-label-sm text-[11px] text-outline">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1 rounded bg-surface-container-high text-on-surface-variant text-[10px]">↑</kbd>
              <kbd className="px-1 rounded bg-surface-container-high text-on-surface-variant text-[10px]">↓</kbd> Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 rounded bg-surface-container-high text-on-surface-variant text-[10px]">↵</kbd> Select
            </span>
          </div>
          <span>Active Role: <strong className="text-on-surface font-semibold">{role}</strong></span>
        </div>
      </div>
    </div>
  );
}
