"use client";

import React from "react";
import DashboardShell from "@/components/layout/DashboardShell";
import RoleGuard from "@/components/auth/RoleGuard";

export default function FacultyLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRole="FACULTY">
      <DashboardShell role="FACULTY">{children}</DashboardShell>
    </RoleGuard>
  );
}
