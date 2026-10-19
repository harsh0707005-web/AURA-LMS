"use client";

import React from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  className?: string;
}

export default function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  className = "",
}: StatCardProps) {
  const isMaterialIcon = icon && /^[a-z0-9_]+$/.test(icon);

  return (
    <div
      className={`bg-surface-container-lowest border border-surface-container-high rounded-2xl p-5 flex flex-col justify-between shadow-sm hover:border-outline-variant transition-all duration-200 ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="font-label-sm text-[11px] font-semibold text-outline uppercase tracking-wider">
          {title}
        </span>
        {icon && (
          <div className="w-9 h-9 rounded-xl bg-surface-container-low border border-surface-container-high flex items-center justify-center text-primary shrink-0 shadow-2xs">
            {isMaterialIcon ? (
              <span className="material-symbols-outlined text-[20px]">{icon}</span>
            ) : (
              <span className="text-base">{icon}</span>
            )}
          </div>
        )}
      </div>

      <div className="my-2.5">
        <div className="font-headline-sm text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">
          {value}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs pt-2.5 border-t border-surface-container-high">
        {subtitle && (
          <span className="font-body-sm text-[11px] text-on-surface-variant font-medium truncate pr-2">
            {subtitle}
          </span>
        )}
        {trend && (
          <span
            className={`font-label-sm inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
              trend.isPositive
                ? "text-[#065f46] bg-[#ecfdf5] border border-[#a7f3d0]"
                : "text-on-error-container bg-error-container border border-error/20"
            }`}
          >
            {trend.isPositive ? "↑" : "↓"} {trend.value}
          </span>
        )}
      </div>
    </div>
  );
}
