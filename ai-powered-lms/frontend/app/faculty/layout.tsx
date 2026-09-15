"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import DashboardShell from "@/components/layout/DashboardShell";

export default function FacultyLayout({ children }: { children: React.ReactNode }) {
  const { status, role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  return <DashboardShell role="FACULTY">{children}</DashboardShell>;
}
