"use client";

import React, { createContext, useContext, useState } from "react";
import Sidebar from "./Sidebar";
import { UserRole } from "@/lib/types";

interface MobileNavContextType {
  isMobileOpen: boolean;
  toggleMobile: () => void;
  closeMobile: () => void;
  isCollapsed: boolean;
  toggleCollapsed: () => void;
}

export const MobileNavContext = createContext<MobileNavContextType>({
  isMobileOpen: false,
  toggleMobile: () => {},
  closeMobile: () => {},
  isCollapsed: false,
  toggleCollapsed: () => {},
});

export function useMobileNav() {
  return useContext(MobileNavContext);
}

interface DashboardShellProps {
  children: React.ReactNode;
  role: UserRole;
}

export function DashboardShell({ children, role }: DashboardShellProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        return localStorage.getItem("aura_sidebar_collapsed") === "true";
      } catch {
        return false;
      }
    }
    return false;
  });

  const toggleMobile = () => setIsMobileOpen((prev) => !prev);
  const closeMobile = () => setIsMobileOpen(false);

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("aura_sidebar_collapsed", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <MobileNavContext.Provider
      value={{
        isMobileOpen,
        toggleMobile,
        closeMobile,
        isCollapsed,
        toggleCollapsed,
      }}
    >
      <div className="flex min-h-screen bg-surface text-on-surface antialiased font-body-md">
        <Sidebar
          role={role}
          isMobileOpen={isMobileOpen}
          onCloseMobile={closeMobile}
          isCollapsed={isCollapsed}
          onToggleCollapsed={toggleCollapsed}
        />
        <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
          {children}
        </div>
      </div>
    </MobileNavContext.Provider>
  );
}

export default DashboardShell;
