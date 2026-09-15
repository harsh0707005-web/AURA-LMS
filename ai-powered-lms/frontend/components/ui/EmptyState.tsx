"use client";

import React from "react";
import Link from "next/link";

interface EmptyStateProps {
  title: string;
  description: string;
  actionText?: string;
  actionHref?: string;
  onAction?: () => void;
  icon?: string;
}

export default function EmptyState({
  title,
  description,
  actionText,
  actionHref,
  onAction,
  icon = "📂",
}: EmptyStateProps) {
  return (
    <div className="bg-white border border-dashed border-slate-300 rounded-lg p-8 sm:p-12 text-center flex flex-col items-center justify-center max-w-md mx-auto my-6 animate-fade-in">
      <div className="h-12 w-12 rounded-xl bg-slate-100/80 border border-slate-200 flex items-center justify-center text-2xl mb-3.5 shadow-2xs">
        {icon}
      </div>
      <h4 className="text-sm font-bold text-slate-900 mb-1">{title}</h4>
      <p className="text-xs text-slate-500 leading-relaxed max-w-xs mb-5">
        {description}
      </p>

      {actionHref && actionText && (
        <Link
          href={actionHref}
          className="btn-press inline-flex items-center px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded shadow-2xs transition-colors"
        >
          {actionText}
        </Link>
      )}

      {onAction && actionText && !actionHref && (
        <button
          onClick={onAction}
          className="btn-press inline-flex items-center px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded shadow-2xs transition-colors cursor-pointer"
        >
          {actionText}
        </button>
      )}
    </div>
  );
}
