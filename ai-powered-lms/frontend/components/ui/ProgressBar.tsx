import React from "react";

interface ProgressBarProps {
  value: number; // 0 - 100
  label?: string;
  showPercentage?: boolean;
  size?: "sm" | "md" | "lg";
  color?: "indigo" | "emerald" | "amber" | "cyan" | "rose";
  className?: string;
}

export function ProgressBar({
  value,
  label,
  showPercentage = true,
  size = "md",
  color = "indigo",
  className = "",
}: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value));

  const heights = {
    sm: "h-1.5",
    md: "h-2.5",
    lg: "h-4",
  };

  const colors = {
    indigo: "bg-indigo-500",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    cyan: "bg-cyan-500",
    rose: "bg-rose-500",
  };

  return (
    <div className={`w-full ${className}`}>
      {(label || showPercentage) && (
        <div className="flex justify-between items-center text-xs text-slate-300 mb-1.5 font-medium">
          {label && <span>{label}</span>}
          {showPercentage && <span className="font-mono text-slate-400">{clampedValue}%</span>}
        </div>
      )}
      <div className={`w-full bg-slate-800 rounded-full overflow-hidden ${heights[size]}`}>
        <div
          className={`${heights[size]} ${colors[color]} rounded-full transition-all duration-500`}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  );
}
