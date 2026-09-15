"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { checkBackendHealth } from "@/lib/api";
import { useMobileNav } from "./DashboardShell";

interface TopbarProps {
  title: string;
  subtitle?: string;
  onMenuClick?: () => void;
}

export function Topbar({ title, subtitle, onMenuClick }: TopbarProps) {
  const { user } = useAuth();
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const mobileNav = useMobileNav();

  const handleMenuClick = onMenuClick || mobileNav.toggleMobile;

  useEffect(() => {
    checkBackendHealth().then((res) => {
      setBackendOnline(res.success);
    });
  }, []);

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20 backdrop-blur-xs bg-white/95">
      <div className="flex items-center space-x-3">
        <button
          onClick={handleMenuClick}
          className="md:hidden p-2 -ml-1 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Open navigation menu"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div>
          <h1 className="text-sm sm:text-base font-bold text-slate-900 leading-tight font-sans">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[11px] text-slate-500 font-medium line-clamp-1">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-3 sm:space-x-4">
        {/* Backend Status Indicator */}
        <div className="hidden sm:flex items-center space-x-2 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200/80 text-xs">
          <span
            className={`h-2 w-2 rounded-full transition-colors ${
              backendOnline === true
                ? "bg-emerald-500 shadow-xs shadow-emerald-500/50"
                : backendOnline === false
                ? "bg-rose-500"
                : "bg-amber-400 animate-pulse"
            }`}
          />
          <span className="text-[11px] font-mono text-slate-600">
            {backendOnline === true
              ? "PostgreSQL Connected"
              : backendOnline === false
              ? "API Offline"
              : "Verifying API..."}
          </span>
        </div>

        {/* Academic Session */}
        <div className="hidden lg:block text-right border-l border-slate-200 pl-4">
          <div className="text-[11px] font-semibold text-slate-700 font-mono">Academic Session 2026</div>
          <div className="text-[10px] text-slate-500">Dept. of Computer Engineering</div>
        </div>

        {/* User Pill */}
        <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 py-1 px-2.5 rounded-md text-xs">
          <div className="h-6 w-6 rounded-full bg-blue-700 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
            {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
          </div>
          <span className="font-semibold text-slate-800 hidden md:inline truncate max-w-[120px]">
            {user?.name || "Academic User"}
          </span>
        </div>
      </div>
    </header>
  );
}

export default Topbar;
