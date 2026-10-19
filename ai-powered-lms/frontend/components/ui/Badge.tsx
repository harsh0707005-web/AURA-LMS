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
    default: "bg-surface-container-high text-primary border-outline-variant/40",
    success: "bg-secondary-container text-on-secondary-container border-secondary/30",
    warning: "bg-amber-500/10 text-amber-800 border-amber-500/30",
    danger: "bg-error-container text-on-error-container border-error/30",
    info: "bg-surface-container text-primary border-outline-variant/40",
    neutral: "bg-surface-container-low text-on-surface-variant border-outline-variant/40",
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-[10px] leading-tight font-mono",
    md: "px-2.5 py-0.5 text-xs font-mono",
  };

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-md border tracking-tight transition-colors duration-150 ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
