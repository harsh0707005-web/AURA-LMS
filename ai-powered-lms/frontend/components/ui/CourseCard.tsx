"use client";

import React from "react";
import Link from "next/link";
import { Course } from "@/lib/types";

interface CourseCardProps {
  course: Course;
  baseHref?: string;
  showProgress?: boolean;
}

export default function CourseCard({
  course,
  baseHref = "/student/courses",
  showProgress = true,
}: CourseCardProps) {
  const progress = course.progressPercentage !== undefined ? course.progressPercentage : 0;

  return (
    <div className="card-interactive p-5 flex flex-col justify-between group">
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200/80 font-mono tracking-wider">
            {course.code}
          </span>
          <span className="text-[11px] font-medium text-slate-500 font-mono">
            {course.credits} Credits • Sem {course.semester}
          </span>
        </div>

        <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors line-clamp-1 mb-1.5 font-sans">
          {course.title}
        </h3>

        <p className="text-xs text-slate-600 line-clamp-2 mb-4 leading-relaxed">
          {course.description}
        </p>

        {course.faculty && (
          <div className="flex items-center space-x-2 text-xs text-slate-500 mb-4 pb-3 border-t border-slate-100 pt-2.5">
            <span className="text-sm">👨‍🏫</span>
            <span className="truncate font-medium text-[11px] text-slate-700">
              {course.faculty.name}
            </span>
          </div>
        )}
      </div>

      <div className="pt-2">
        {showProgress && (
          <div className="mb-3.5">
            <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1.5 font-mono">
              <span>Syllabus Progress</span>
              <span className="text-blue-700 font-bold">{progress}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-blue-700 h-1.5 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <span className="text-[11px] text-slate-500 font-medium">
            {course._count ? `${course._count.materials || 0} Materials` : "Course Content"}
          </span>

          <Link
            href={`${baseHref}/${course.id}`}
            className="btn-press text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center space-x-1 py-1 px-2 rounded hover:bg-blue-50/60 transition-colors"
          >
            <span>Access Course</span>
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
