"use client";

import React from "react";
import DashboardShell from "@/components/layout/DashboardShell";
import RoleGuard from "@/components/auth/RoleGuard";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRole="STUDENT">
      <DashboardShell role="STUDENT">{children}</DashboardShell>
    </RoleGuard>
  );
}
