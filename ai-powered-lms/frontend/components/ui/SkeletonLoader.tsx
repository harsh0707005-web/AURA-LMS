"use client";

import React from "react";

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 animate-fade-in">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white border border-slate-200 rounded-lg p-5 space-y-4"
        >
          <div className="flex justify-between items-center">
            <div className="h-5 w-16 bg-slate-100 animate-shimmer rounded" />
            <div className="h-4 w-20 bg-slate-100 animate-shimmer rounded" />
          </div>
          <div className="h-5 w-3/4 bg-slate-100 animate-shimmer rounded" />
          <div className="space-y-2">
            <div className="h-3 w-full bg-slate-100 animate-shimmer rounded" />
            <div className="h-3 w-5/6 bg-slate-100 animate-shimmer rounded" />
          </div>
          <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
            <div className="h-4 w-20 bg-slate-100 animate-shimmer rounded" />
            <div className="h-4 w-16 bg-slate-100 animate-shimmer rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden animate-fade-in">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center">
        <div className="h-5 w-36 bg-slate-100 animate-shimmer rounded" />
        <div className="h-4 w-24 bg-slate-100 animate-shimmer rounded" />
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="p-3.5 flex items-center justify-between space-x-4">
            {Array.from({ length: cols }).map((_, c) => (
              <div
                key={c}
                className="h-4 bg-slate-100 animate-shimmer rounded"
                style={{ width: `${Math.floor(100 / cols) - 4}%` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatRowSkeleton({ count = 4 }: { count?: number } = {}) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${count} gap-4 animate-fade-in`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
          <div className="flex justify-between items-center">
            <div className="h-3.5 w-24 bg-slate-100 animate-shimmer rounded" />
            <div className="h-6 w-6 bg-slate-100 animate-shimmer rounded-md" />
          </div>
          <div className="h-7 w-16 bg-slate-100 animate-shimmer rounded" />
          <div className="h-3 w-32 bg-slate-100 animate-shimmer rounded" />
        </div>
      ))}
    </div>
  );
}

export default function SkeletonLoader() {
  return <CardSkeleton />;
}
