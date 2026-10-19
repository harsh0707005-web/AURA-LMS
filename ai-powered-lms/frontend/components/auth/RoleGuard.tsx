"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { UserRole } from "@/lib/types";

const roleHomePaths: Record<UserRole, string> = {
  STUDENT: "/student/dashboard",
  FACULTY: "/faculty/dashboard",
  ADMIN: "/admin/dashboard",
};

interface RoleGuardProps {
  allowedRole: UserRole;
  children: React.ReactNode;
}

export default function RoleGuard({ allowedRole, children }: RoleGuardProps) {
  const { status, role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    } else if (status === "authenticated" && role !== allowedRole) {
      if (role) {
        router.replace(roleHomePaths[role]);
      } else {
        router.replace("/login");
      }
    }
  }, [allowedRole, role, router, status]);

  if (status !== "authenticated" || role !== allowedRole) {
    return null;
  }

  return <>{children}</>;
}
