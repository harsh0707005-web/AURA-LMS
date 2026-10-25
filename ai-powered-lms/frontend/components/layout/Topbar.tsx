"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { apiRequest } from "@/lib/api";
import { AppNotification, NotificationSummary } from "@/lib/types";
import { useMobileNav } from "./DashboardShell";
import CommandPalette from "./CommandPalette";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface TopbarProps {
  title: string;
  subtitle?: string;
  onMenuClick?: () => void;
  breadcrumbs?: BreadcrumbItem[];
}

const ROUTE_LABELS: Record<string, string> = {
  student: "Student",
  faculty: "Faculty",
  admin: "Admin",
  dashboard: "Dashboard",
  courses: "Courses",
  materials: "Materials",
  "ai-tutor": "AI Course Tutor",
  recommendations: "Recommendations",
  quizzes: "Quizzes",
  assignments: "Assignments",
  performance: "Performance",
  students: "Student Roster",
  analytics: "Academic Analytics",
  announcements: "Announcements",
  users: "User Accounts",
  profile: "Profile",
  create: "New Course",
};

export function Topbar({ title, subtitle, onMenuClick, breadcrumbs }: TopbarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const mobileNav = useMobileNav();
  const handleMenuClick = onMenuClick || mobileNav.toggleMobile;

  const loadNotifications = async () => {
    if (!user) return;
    try {
      setNotificationsLoading(true);
      const response = await apiRequest<NotificationSummary>("/notifications");
      if (response.success && response.data) {
        setNotifications(response.data.items || []);
        setUnreadCount(response.data.unreadCount || 0);
      }
    } catch {
      // The notification center is supplemental; keep the rest of the workspace usable.
    } finally {
      setNotificationsLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    void apiRequest<NotificationSummary>("/notifications")
      .then((response) => {
        if (cancelled || !response.success || !response.data) return;
        setNotifications(response.data.items || []);
        setUnreadCount(response.data.unreadCount || 0);
      })
      .catch(() => {
        // The notification center is supplemental; keep the rest of the workspace usable.
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Global Cmd+K / Ctrl+K listener for Command Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setIsUserMenuOpen(false);
        setIsNotificationsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Outside click listeners for menus
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Derive dynamic breadcrumbs from pathname if not provided explicitly
  const computedBreadcrumbs: BreadcrumbItem[] = React.useMemo(() => {
    if (breadcrumbs && breadcrumbs.length > 0) return breadcrumbs;

    const segments = pathname.split("/").filter(Boolean);
    const crumbs: BreadcrumbItem[] = [{ label: "Home", href: "/" }];

    let accPath = "";
    segments.forEach((seg, idx) => {
      accPath += `/${seg}`;
      const isLast = idx === segments.length - 1;
      const label = ROUTE_LABELS[seg] || (seg.length > 12 ? "Details" : seg);
      crumbs.push({
        label,
        href: isLast ? undefined : accPath,
      });
    });

    return crumbs;
  }, [breadcrumbs, pathname]);

  const profileHref =
    user?.role === "FACULTY"
      ? "/faculty/profile"
      : user?.role === "ADMIN"
      ? "/admin/dashboard"
      : "/student/profile";

  const dashboardHref =
    user?.role === "FACULTY"
      ? "/faculty/dashboard"
      : user?.role === "ADMIN"
      ? "/admin/dashboard"
      : "/student/dashboard";

  return (
    <>
      <header
        className="h-16 bg-surface-container-lowest/90 backdrop-blur-md border-b border-surface-container-high/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20 shadow-[0_1px_4px_rgba(0,0,0,0.03)]"
        aria-label="Master Topbar"
      >
        {/* Left: Mobile Toggle & Page Info / Breadcrumbs */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={handleMenuClick}
            className="md:hidden p-2 -ml-1 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden"
            aria-label="Open navigation drawer"
            aria-expanded={mobileNav.isMobileOpen}
            aria-controls="mobile-navigation-drawer"
          >
            <span className="material-symbols-outlined text-[22px]">menu</span>
          </button>

          <div className="min-w-0 flex flex-col justify-center">
            {/* Dynamic Breadcrumbs */}
            <nav
              aria-label="Breadcrumbs"
              className="hidden sm:flex items-center gap-1 text-[11px] font-body-sm text-outline leading-none mb-1"
            >
              {computedBreadcrumbs.map((crumb, idx) => (
                <React.Fragment key={crumb.href || idx}>
                  {idx > 0 && (
                    <span
                      className="material-symbols-outlined text-[12px] text-outline/60 select-none"
                      aria-hidden="true"
                    >
                      chevron_right
                    </span>
                  )}
                  {crumb.href ? (
                    <Link
                      href={crumb.href}
                      className="hover:text-primary transition-colors truncate max-w-30"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-on-surface-variant font-medium truncate max-w-35">
                      {crumb.label}
                    </span>
                  )}
                </React.Fragment>
              ))}
            </nav>

            {/* Page Title & Subtitle */}
            <div className="flex items-baseline gap-2 min-w-0">
              <h1 className="font-headline-sm text-headline-sm font-bold text-on-surface leading-tight truncate">
                {title}
              </h1>
              {subtitle && (
                <span className="hidden xl:inline text-body-sm text-outline font-normal truncate max-w-sm">
                  • {subtitle}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center: Command Search Trigger */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => setIsCommandOpen(true)}
            className="relative hidden md:flex items-center w-64 lg:w-80 h-9 pl-9 pr-12 rounded-xl bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container border border-surface-container-high transition-colors cursor-pointer text-left font-body-sm text-body-sm shadow-2xs focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden"
            aria-label="Search navigation and commands (Ctrl+K or Cmd+K)"
          >
            <span className="material-symbols-outlined absolute left-2.5 text-outline text-[18px]">
              search
            </span>
            <span className="truncate text-outline text-body-sm">
              Search routes, tools...
            </span>
            <kbd className="absolute right-2 px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-label-sm text-[10px] border border-surface-container-highest">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right: Department Info, Notifications & User Menu */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Workspace context (Desktop) */}
          <div className="hidden lg:block text-right">
            <div className="text-[11px] font-semibold text-on-surface font-label-sm leading-tight">
              {user?.department || "Academic Workspace"}
            </div>
            <div className="text-[10px] text-outline leading-tight">
              {user?.role ? `${user.role.toLowerCase()} access` : "Authenticated access"}
            </div>
          </div>

          {/* Truthful Notifications Drawer Trigger (No fabricated counts) */}
           <div className="relative" ref={notificationsRef}>
             <button
               type="button"
               onClick={() => {
                 setIsNotificationsOpen((prev) => !prev);
                 if (!isNotificationsOpen) loadNotifications();
               }}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden"
              aria-label="View notifications"
              aria-expanded={isNotificationsOpen}
            >
               <span className="material-symbols-outlined text-[20px]">notifications</span>
               {unreadCount > 0 && (
                 <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-error px-1 text-center text-[9px] font-bold leading-4 text-on-error" aria-label={`${unreadCount} unread notifications`}>
                   {unreadCount > 9 ? "9+" : unreadCount}
                 </span>
               )}
            </button>

            {isNotificationsOpen && (
              <div
                role="dialog"
                aria-label="Notification center"
                className="absolute right-0 top-11 w-72 sm:w-80 bg-surface-container-lowest border border-surface-container-high rounded-2xl shadow-xl p-4 z-40 animate-fade-in"
              >
                <div className="flex items-center justify-between pb-2 border-b border-surface-container-high">
                  <span className="font-headline-sm text-xs font-bold text-on-surface">
                    Notifications
                  </span>
                  <span className="font-label-sm text-[10px] text-outline uppercase tracking-wider">
                    Live Stream
                  </span>
                </div>
                 {notificationsLoading ? (
                   <div className="py-8 text-center text-xs text-on-surface-variant">Loading notifications...</div>
                 ) : notifications.length === 0 ? (
                   <div className="py-8 text-center text-on-surface-variant">
                     <span className="material-symbols-outlined mb-1 block text-[26px] text-outline">notifications_none</span>
                     <p className="font-body-sm text-xs">No notifications yet</p>
                     <p className="mt-0.5 font-label-sm text-[10px] text-outline">Course announcements will appear here.</p>
                   </div>
                 ) : (
                   <div className="max-h-80 space-y-1 overflow-y-auto py-2">
                     {notifications.slice(0, 6).map((notification) => {
                       const href = notification.link || (user?.role === "STUDENT" ? "/student/announcements" : "/announcements");
                       return (
                         <Link
                           key={notification.id}
                           href={href}
                           onClick={async () => {
                             if (!notification.readAt) {
                               try { await apiRequest(`/notifications/${notification.id}/read`, { method: "PATCH" }); } catch { /* keep navigation usable */ }
                               setUnreadCount((count) => Math.max(0, count - 1));
                               setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item));
                             }
                             setIsNotificationsOpen(false);
                           }}
                           className={`block rounded-xl px-3 py-2.5 transition-colors hover:bg-surface-container ${notification.readAt ? "opacity-70" : "bg-primary-fixed/40"}`}
                         >
                           <div className="flex items-start gap-2">
                             <span className="material-symbols-outlined mt-0.5 text-[17px] text-primary">campaign</span>
                             <span className="min-w-0">
                               <span className="block truncate text-xs font-semibold text-on-surface">{notification.title}</span>
                               <span className="mt-0.5 block line-clamp-2 text-[11px] text-on-surface-variant">{notification.body}</span>
                               <span className="mt-1 block text-[10px] text-outline">{new Date(notification.createdAt).toLocaleString()}</span>
                             </span>
                           </div>
                         </Link>
                       );
                     })}
                   </div>
                 )}
                 {notifications.length > 0 && (
                   <div className="flex items-center justify-between border-t border-surface-container-high pt-2">
                     <Link href={user?.role === "STUDENT" ? "/student/announcements" : user?.role === "FACULTY" ? "/faculty/announcements" : "/admin/announcements"} onClick={() => setIsNotificationsOpen(false)} className="text-[11px] font-semibold text-primary hover:text-primary-container">Open announcements</Link>
                     {unreadCount > 0 && <button type="button" onClick={async () => { try { await apiRequest("/notifications/read-all", { method: "PATCH" }); setUnreadCount(0); setNotifications((items) => items.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() }))); } catch { /* keep current state */ } }} className="text-[11px] font-semibold text-on-surface-variant hover:text-on-surface">Mark all read</button>}
                   </div>
                 )}
              </div>
            )}
          </div>

          {/* User Profile Pill & Dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 p-1 pl-1.5 rounded-xl bg-surface-container-low hover:bg-surface-container border border-surface-container-high transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden"
              aria-expanded={isUserMenuOpen}
              aria-haspopup="true"
              aria-label="User account menu"
            >
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-on-primary font-bold text-xs shadow-xs shrink-0">
                {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
              </div>
              <span className="font-semibold text-on-surface text-xs hidden md:inline truncate max-w-27.5">
                {user?.name || "Academic User"}
              </span>
              <span className="material-symbols-outlined text-outline text-[18px]">
                keyboard_arrow_down
              </span>
            </button>

            {/* Dropdown Menu */}
            {isUserMenuOpen && (
              <div
                role="menu"
                aria-label="User menu"
                className="absolute right-0 top-11 w-64 bg-surface-container-lowest border border-surface-container-high rounded-2xl shadow-xl p-2 z-40 animate-fade-in space-y-1"
              >
                {/* User Info Header */}
                <div className="px-3 py-2 bg-surface-container-low rounded-xl">
                  <div className="font-semibold text-on-surface text-xs truncate">
                    {user?.name || "Academic User"}
                  </div>
                  <div className="font-label-sm text-[10px] text-outline truncate mt-0.5">
                    {user?.email || "user@college.edu"}
                  </div>
                  <div className="mt-1.5">
                    <span className="font-label-sm text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-primary-container text-on-primary font-bold">
                      {user?.role || "STUDENT"}
                    </span>
                  </div>
                </div>

                {/* Navigation Links */}
                <div className="pt-1">
                  <Link
                    href={dashboardHref}
                    onClick={() => setIsUserMenuOpen(false)}
                    role="menuitem"
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-body-sm text-on-surface hover:bg-surface-container-low transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px] text-primary">
                      dashboard
                    </span>
                    <span>Dashboard</span>
                  </Link>
                  <Link
                    href={profileHref}
                    onClick={() => setIsUserMenuOpen(false)}
                    role="menuitem"
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-body-sm text-on-surface hover:bg-surface-container-low transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px] text-primary">
                      account_circle
                    </span>
                    <span>Profile & Account</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setIsCommandOpen(true);
                    }}
                    role="menuitem"
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-body-sm text-on-surface hover:bg-surface-container-low transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-[18px] text-secondary">
                        terminal
                      </span>
                      <span>Command Search</span>
                    </div>
                    <kbd className="px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-label-sm text-[10px]">
                      ⌘K
                    </kbd>
                  </button>
                </div>

                {/* Divider & Sign Out */}
                <div className="border-t border-surface-container-high pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      logout();
                    }}
                    role="menuitem"
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-body-sm text-error hover:bg-error-container/40 transition-colors text-left font-medium cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">logout</span>
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Interactive Command Search Modal */}
      <CommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
      />
    </>
  );
}

export default Topbar;
