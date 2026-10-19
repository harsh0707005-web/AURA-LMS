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
  icon = "folder_open",
}: EmptyStateProps) {
  const isMaterialIcon = typeof icon === "string" && !icon.includes(" ");

  return (
    <div className="bg-surface-container-lowest border border-dashed border-outline-variant/60 rounded-2xl p-8 sm:p-12 text-center flex flex-col items-center justify-center max-w-md mx-auto my-6 animate-fade-in text-on-surface">
      <div className="w-12 h-12 rounded-xl bg-surface-container text-primary flex items-center justify-center mb-3.5 shadow-2xs">
        {isMaterialIcon && icon !== "📂" ? (
          <span className="material-symbols-outlined text-[26px]">{icon}</span>
        ) : (
          <span className="text-2xl">📂</span>
        )}
      </div>
      <h4 className="text-sm font-bold text-on-surface mb-1">{title}</h4>
      <p className="text-xs text-on-surface-variant leading-relaxed max-w-xs mb-5">
        {description}
      </p>

      {actionHref && actionText && (
        <Link
          href={actionHref}
          className="inline-flex items-center px-4 py-2 bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold rounded-lg shadow-2xs transition-colors"
        >
          {actionText}
        </Link>
      )}

      {onAction && actionText && !actionHref && (
        <button
          onClick={onAction}
          className="inline-flex items-center px-4 py-2 bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
        >
          {actionText}
        </button>
      )}
    </div>
  );
}
