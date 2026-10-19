"use client";

import React from "react";
import DashboardShell from "@/components/layout/DashboardShell";
import RoleGuard from "@/components/auth/RoleGuard";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRole="ADMIN">
      <DashboardShell role="ADMIN">{children}</DashboardShell>
    </RoleGuard>
  );
}
