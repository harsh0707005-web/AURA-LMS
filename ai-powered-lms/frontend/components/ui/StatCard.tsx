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
  return (
    <div
      className={`card-interactive p-5 flex flex-col justify-between group ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
          {title}
        </span>
        {icon && (
          <div className="h-8 w-8 rounded-md bg-slate-50 group-hover:bg-blue-50/80 border border-slate-200/60 flex items-center justify-center text-base transition-colors duration-200">
            {icon}
          </div>
        )}
      </div>

      <div className="my-2.5">
        <div className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight font-sans">
          {value}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
        {subtitle && <span className="text-slate-500 font-medium text-[11px]">{subtitle}</span>}
        {trend && (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
              trend.isPositive
                ? "text-emerald-700 bg-emerald-50 border border-emerald-200/60"
                : "text-rose-700 bg-rose-50 border border-rose-200/60"
            }`}
          >
            {trend.isPositive ? "↑" : "↓"} {trend.value}
          </span>
        )}
      </div>
    </div>
  );
}
