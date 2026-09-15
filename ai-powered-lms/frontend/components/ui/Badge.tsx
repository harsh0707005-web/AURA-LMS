"use client";

import React from "react";

interface BadgeProps {
  variant?: "default" | "success" | "warning" | "danger" | "info" | "neutral";
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md";
}

export default function Badge({
  variant = "default",
  children,
  className = "",
  size = "md",
}: BadgeProps) {
  const variantStyles = {
    default: "bg-blue-50 text-blue-800 border-blue-200/80",
    success: "bg-emerald-50 text-emerald-800 border-emerald-200/80",
    warning: "bg-amber-50 text-amber-800 border-amber-200/80",
    danger: "bg-rose-50 text-rose-800 border-rose-200/80",
    info: "bg-sky-50 text-sky-800 border-sky-200/80",
    neutral: "bg-slate-100 text-slate-700 border-slate-200/80",
  };

  const sizeStyles = {
    sm: "px-1.5 py-0.2 text-[10px] leading-tight",
    md: "px-2 py-0.5 text-xs",
  };

  return (
    <span
      className={`inline-flex items-center font-semibold rounded border font-mono tracking-tight transition-colors duration-150 ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
