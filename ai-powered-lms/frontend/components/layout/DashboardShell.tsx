"use client";

import React, { createContext, useContext, useState } from "react";
import Sidebar from "./Sidebar";
import { UserRole } from "@/lib/types";

interface MobileNavContextType {
  isMobileOpen: boolean;
  toggleMobile: () => void;
  closeMobile: () => void;
}

export const MobileNavContext = createContext<MobileNavContextType>({
  isMobileOpen: false,
  toggleMobile: () => {},
  closeMobile: () => {},
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

  const toggleMobile = () => setIsMobileOpen((prev) => !prev);
  const closeMobile = () => setIsMobileOpen(false);

  return (
    <MobileNavContext.Provider value={{ isMobileOpen, toggleMobile, closeMobile }}>
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar
          role={role}
          isMobileOpen={isMobileOpen}
          onCloseMobile={closeMobile}
        />
        <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden animate-fade-in">
          {children}
        </div>
      </div>
    </MobileNavContext.Provider>
  );
}

export default DashboardShell;
