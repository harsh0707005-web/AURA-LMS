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
    <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-5 flex flex-col justify-between shadow-sm hover:border-outline-variant transition-all duration-200 group">
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <span className="px-2 py-0.5 rounded font-label-sm text-[10px] font-bold bg-primary-fixed/80 text-primary border border-primary/20 tracking-wider">
            {course.code}
          </span>
          <span className="font-label-sm text-[11px] font-medium text-outline">
            {course.credits} Credits • Sem {course.semester}
          </span>
        </div>

        <h3 className="font-headline-sm text-sm font-bold text-on-surface group-hover:text-primary transition-colors line-clamp-1 mb-1.5">
          {course.title}
        </h3>

        <p className="font-body-sm text-xs text-on-surface-variant line-clamp-2 mb-4 leading-relaxed">
          {course.description}
        </p>

        {course.faculty && (
          <div className="flex items-center gap-2 text-xs text-on-surface-variant mb-4 pb-3 border-t border-surface-container-high pt-2.5">
            <span className="material-symbols-outlined text-[16px] text-outline">person</span>
            <span className="truncate font-medium text-[11px] text-on-surface">
              {course.faculty.name}
            </span>
          </div>
        )}
      </div>

      <div className="pt-2">
        {showProgress && (
          <div className="mb-3.5">
            <div className="flex justify-between font-label-sm text-[11px] font-semibold text-on-surface-variant mb-1.5">
              <span>Syllabus Progress</span>
              <span className="text-primary font-bold">{progress}%</span>
            </div>
            <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-primary-container h-1.5 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2.5 border-t border-surface-container-high">
          <span className="font-label-sm text-[11px] text-outline font-medium">
            {course._count ? `${course._count.materials || 0} Materials` : "Course Content"}
          </span>

          <Link
            href={`${baseHref}/${course.id}`}
            className="font-body-sm text-xs font-semibold text-primary hover:underline flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-surface-container-low transition-colors"
          >
            <span>Access Course</span>
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
