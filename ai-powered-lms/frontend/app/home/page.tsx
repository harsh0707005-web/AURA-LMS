"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";

const navItems = [
  { label: "Platform Overview", href: "#overview" },
  { label: "Student Workflow", href: "#workflow" },
  { label: "AI Course Tutor", href: "#ai-tutor" },
  { label: "Learning Analytics", href: "#analytics" },
  { label: "Faculty Tools", href: "#faculty" },
  { label: "Governance", href: "#security" },
];

const capabilities = [
  {
    icon: "school",
    tone: "text-primary",
    title: "Course workspaces",
    description:
      "Students work from enrolled courses, course materials, assignments, quizzes, and progress views in one focused workspace.",
  },
  {
    icon: "smart_toy",
    tone: "text-secondary",
    title: "Course-grounded AI tutoring",
    description:
      "The authenticated AI Tutor uses available course context to support questions and explanations alongside the learning workflow.",
  },
  {
    icon: "monitoring",
    tone: "text-tertiary",
    title: "Actionable academic signals",
    description:
      "Performance, weak-topic, recommendation, and faculty analytics views make the data already captured by the LMS easier to act on.",
  },
];

const workflowSteps = [
  { step: "01", title: "Open course materials", desc: "Review the syllabus, lectures, and documents available for an enrolled course." },
  { step: "02", title: "Complete assessments", desc: "Take quizzes and submit assignments through the authenticated student workspace." },
  { step: "03", title: "Review performance", desc: "Use attempt results and weak-topic views to see where additional practice can help." },
  { step: "04", title: "Ask and practice", desc: "Use recommendations and the course AI Tutor to continue the next study session." },
];

export default function LandingPage() {
  const { user, role, status } = useAuth();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMobileNavOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isMobileNavOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileNavOpen]);

  const dashboardHref =
    role === "FACULTY" ? "/faculty/dashboard" : role === "ADMIN" ? "/admin/dashboard" : "/student/dashboard";
  const dashboardLabel =
    role === "FACULTY" ? "Faculty Portal" : role === "ADMIN" ? "Admin Console" : "Student Workspace";

  const closeMobileNav = () => setIsMobileNavOpen(false);

  return (
    <div id="top" className="min-h-screen bg-surface text-on-surface flex flex-col font-body-md antialiased">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-on-primary"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-40 border-b border-outline-variant/50 bg-surface-container-lowest/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="#top" className="group flex shrink-0 items-center gap-3 rounded-lg p-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-on-primary shadow-xs transition-colors group-hover:bg-primary-container" aria-hidden="true">
              <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
            </span>
            <span className="flex flex-col leading-none">
              <span className="font-headline-sm text-headline-sm font-bold tracking-tight">AURA</span>
              <span className="font-label-sm text-[10px] uppercase tracking-[0.16em] text-outline">LMS Platform</span>
            </span>
          </Link>

          <nav aria-label="Primary navigation" className="hidden items-center gap-5 xl:flex">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} className="rounded-md px-1 py-2 font-label-sm text-label-sm text-on-surface-variant transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden">
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {status === "authenticated" && user ? (
              <>
                <span className="hidden max-w-32 truncate text-xs font-medium text-on-surface-variant sm:inline">{user.name}</span>
                <Link href={dashboardHref} className="hidden items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-on-primary shadow-xs transition-colors hover:bg-primary-container focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-hidden sm:flex">
                  {dashboardLabel}
                  <span className="material-symbols-outlined text-[15px]" aria-hidden="true">arrow_forward</span>
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="hidden rounded-md px-3 py-2 text-xs font-semibold text-on-surface transition-colors hover:bg-surface-container-low hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden sm:inline-flex">
                  Sign In
                </Link>
                <Link href="/register" className="hidden rounded-md bg-primary px-3.5 py-2 text-xs font-semibold text-on-primary shadow-xs transition-colors hover:bg-primary-container focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-hidden sm:inline-flex">
                  Create Account
                </Link>
              </>
            )}
            <button
              type="button"
              onClick={() => setIsMobileNavOpen((open) => !open)}
              className="rounded-md p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden xl:hidden"
              aria-label={isMobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={isMobileNavOpen}
              aria-controls="mobile-public-navigation"
            >
              <span className="material-symbols-outlined" aria-hidden="true">{isMobileNavOpen ? "close" : "menu"}</span>
            </button>
          </div>
        </div>

        {isMobileNavOpen && (
          <div id="mobile-public-navigation" className="border-t border-outline-variant/50 bg-surface-container-lowest px-4 pb-4 pt-2 shadow-sm xl:hidden">
            <nav aria-label="Mobile primary navigation" className="mx-auto flex max-w-7xl flex-col gap-1">
              {navItems.map((item) => (
                <a key={item.href} href={item.href} onClick={closeMobileNav} className="rounded-md px-3 py-3 font-label-sm text-label-sm text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden">
                  {item.label}
                </a>
              ))}
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-outline-variant/50 pt-3 sm:hidden">
                <Link href="/login" onClick={closeMobileNav} className="rounded-md border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-center text-xs font-semibold text-on-surface focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden">Sign In</Link>
                <Link href="/register" onClick={closeMobileNav} className="rounded-md bg-primary px-3 py-2.5 text-center text-xs font-semibold text-on-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-hidden">Create Account</Link>
              </div>
              {status === "authenticated" && user && (
                <Link href={dashboardHref} onClick={closeMobileNav} className="mt-2 flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2.5 text-xs font-semibold text-on-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-hidden sm:hidden">
                  Open {dashboardLabel}
                  <span className="material-symbols-outlined text-[15px]" aria-hidden="true">arrow_forward</span>
                </Link>
              )}
            </nav>
          </div>
        )}
      </header>

      <main id="main-content" className="flex-1">
        <section className="border-b border-outline-variant/50 bg-surface-container-lowest py-20 sm:py-28" aria-labelledby="hero-heading">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="animate-fade-in">
                <div className="mb-6 inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary-fixed px-3 py-1.5 font-label-sm text-label-sm text-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-secondary" aria-hidden="true" />
                  Academic Precision / Learning Workspace
                </div>
                <h1 id="hero-heading" className="max-w-3xl font-display-lg-mobile text-display-lg-mobile text-on-surface sm:text-display-lg">
                  A focused system for learning, assessment, and academic support.
                </h1>
                <p className="mt-6 max-w-2xl font-body-lg text-body-lg text-on-surface-variant">
                  AURA LMS brings course materials, quizzes, assignments, performance views, and course-grounded AI tutoring into one university learning workflow.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href="/login" className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-on-primary shadow-xs transition-colors hover:bg-primary-container focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-hidden">
                    Sign In to Workspace
                    <span className="material-symbols-outlined text-[17px]" aria-hidden="true">arrow_forward</span>
                  </Link>
                  <Link href="/register" className="inline-flex items-center rounded-md border border-outline-variant bg-surface-container-lowest px-5 py-3 text-sm font-semibold text-on-surface transition-colors hover:border-primary/40 hover:bg-surface-container-low focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden">
                    Create Account
                  </Link>
                </div>
                <p className="mt-4 font-label-sm text-label-sm text-outline">Public landing page • authenticated tools stay behind sign-in</p>
              </div>

              <div className="relative overflow-hidden rounded-xl border border-outline-variant bg-surface p-5 shadow-sm sm:p-6" aria-label="AURA workspace preview">
                <div className="absolute right-0 top-0 h-32 w-32 translate-x-1/3 -translate-y-1/3 rounded-full bg-primary-fixed/60 blur-2xl" aria-hidden="true" />
                <div className="relative space-y-4">
                  <div className="flex items-center justify-between border-b border-outline-variant/60 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary" aria-hidden="true">dashboard</span>
                      <span className="font-label-md text-label-md font-semibold">STUDENT WORKSPACE</span>
                    </div>
                    <span className="rounded bg-secondary-container px-2 py-1 font-label-sm text-label-sm text-on-secondary-container">ACTIVE</span>
                  </div>
                  <div className="rounded-lg border border-outline-variant/70 bg-surface-container-lowest p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-label-sm text-label-sm text-primary">COURSE MATERIALS</p>
                        <p className="mt-1 font-headline-sm text-headline-sm">Continue with your enrolled course</p>
                      </div>
                      <span className="material-symbols-outlined text-secondary" aria-hidden="true">menu_book</span>
                    </div>
                    <div className="mt-4 flex items-center gap-2 border-t border-outline-variant/60 pt-3 font-label-sm text-label-sm text-on-surface-variant"><span className="material-symbols-outlined text-[16px] text-secondary" aria-hidden="true">check_circle</span><span>Course-specific progress is shown after sign-in.</span></div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-outline-variant/70 bg-surface-container-low p-3">
                      <span className="material-symbols-outlined text-primary" aria-hidden="true">quiz</span>
                      <p className="mt-2 font-label-sm text-label-sm text-on-surface-variant">QUIZZES &amp; ATTEMPTS</p>
                    </div>
                    <div className="rounded-lg border border-outline-variant/70 bg-surface-container-low p-3">
                      <span className="material-symbols-outlined text-secondary" aria-hidden="true">psychology</span>
                      <p className="mt-2 font-label-sm text-label-sm text-on-surface-variant">AI COURSE TUTOR</p>
                    </div>
                  </div>
                  <p className="border-l-2 border-secondary bg-secondary-container/30 px-3 py-2 font-body-sm text-body-sm text-on-surface-variant">Use the same course context across study, assessment, and review.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="overview" className="scroll-mt-20 border-b border-outline-variant/50 bg-surface py-20" aria-labelledby="overview-heading">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10 max-w-2xl">
              <span className="font-label-sm text-label-sm uppercase tracking-[0.16em] text-primary">Platform Overview</span>
              <h2 id="overview-heading" className="mt-2 font-headline-xl text-headline-xl">A practical academic loop, with clear boundaries.</h2>
              <p className="mt-3 font-body-md text-body-md text-on-surface-variant">AURA keeps the public surface concise and lets authenticated workspaces provide the course-specific data.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {capabilities.map((item) => (
                <article key={item.title} className="rounded-lg border border-outline-variant bg-surface-container-lowest p-5 shadow-xs transition-colors hover:border-outline">
                  <span className={`material-symbols-outlined ${item.tone} text-[24px]`} aria-hidden="true">{item.icon}</span>
                  <h3 className="mt-4 font-headline-sm text-headline-sm">{item.title}</h3>
                  <p className="mt-2 font-body-md text-body-md text-on-surface-variant">{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="scroll-mt-20 border-b border-outline-variant/50 bg-surface-container-lowest py-20" aria-labelledby="workflow-heading">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10 max-w-2xl">
              <span className="font-label-sm text-label-sm uppercase tracking-[0.16em] text-secondary">Student Workflow</span>
              <h2 id="workflow-heading" className="mt-2 font-headline-xl text-headline-xl">A repeatable path from material to mastery.</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {workflowSteps.map((item) => (
                <article key={item.step} className="rounded-lg border border-outline-variant bg-surface p-5">
                  <span className="font-label-md text-label-md font-semibold text-primary">{item.step}</span>
                  <h3 className="mt-4 font-headline-sm text-headline-sm">{item.title}</h3>
                  <p className="mt-2 font-body-md text-body-md text-on-surface-variant">{item.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="ai-tutor" className="scroll-mt-20 border-b border-outline-variant/50 bg-surface py-20" aria-labelledby="tutor-heading">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div>
              <span className="font-label-sm text-label-sm uppercase tracking-[0.16em] text-secondary">AI Course Tutor</span>
              <h2 id="tutor-heading" className="mt-2 font-headline-xl text-headline-xl">Support that stays close to the course.</h2>
              <p className="mt-4 max-w-xl font-body-lg text-body-lg text-on-surface-variant">The AI Tutor is available inside the authenticated student experience, where it can use the course and material context supplied by the LMS.</p>
              <ul className="mt-6 space-y-3 font-body-md text-body-md text-on-surface">
                <li className="flex items-start gap-3"><span className="material-symbols-outlined mt-0.5 text-secondary" aria-hidden="true">check_circle</span><span>Ask questions from the student AI Tutor workspace.</span></li>
                <li className="flex items-start gap-3"><span className="material-symbols-outlined mt-0.5 text-secondary" aria-hidden="true">check_circle</span><span>Keep questions connected to enrolled course context and uploaded materials.</span></li>
                <li className="flex items-start gap-3"><span className="material-symbols-outlined mt-0.5 text-secondary" aria-hidden="true">check_circle</span><span>Use explanations as a companion to the existing assessment and recommendation views.</span></li>
              </ul>
              <Link href="/login" className="mt-7 inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary-fixed px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary-fixed-dim focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden">Open the Tutor Workspace <span className="material-symbols-outlined text-[17px]" aria-hidden="true">arrow_forward</span></Link>
            </div>
            <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-5 shadow-xs sm:p-6">
              <div className="flex items-center justify-between border-b border-outline-variant/60 pb-3"><span className="flex items-center gap-2 font-label-md text-label-md font-semibold"><span className="material-symbols-outlined text-primary" aria-hidden="true">smart_toy</span>COURSE AI TUTOR</span><span className="font-label-sm text-label-sm text-secondary">CONTEXT AWARE</span></div>
              <div className="mt-5 space-y-3 font-body-md text-body-md">
                <div className="ml-8 rounded-lg bg-primary px-4 py-3 text-on-primary">How can I review the concepts in my current course?</div>
                <div className="rounded-lg border border-outline-variant bg-surface-container-low p-4 text-on-surface-variant"><span className="font-semibold text-on-surface">Tutor workspace</span><p className="mt-1">Select a course and ask a question. The authenticated workflow provides the relevant context for the response.</p><div className="mt-3 flex items-center gap-2 border-t border-outline-variant/60 pt-2 font-label-sm text-label-sm text-secondary"><span className="material-symbols-outlined text-[15px]" aria-hidden="true">menu_book</span>Course material context</div></div>
              </div>
            </div>
          </div>
        </section>

        <section id="analytics" className="scroll-mt-20 border-b border-outline-variant/50 bg-surface-container-lowest py-20" aria-labelledby="analytics-heading">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
              <div>
                <span className="font-label-sm text-label-sm uppercase tracking-[0.16em] text-tertiary">Learning Analytics</span>
                <h2 id="analytics-heading" className="mt-2 font-headline-xl text-headline-xl">See the learning signals the system already records.</h2>
                <p className="mt-4 font-body-lg text-body-lg text-on-surface-variant">Authenticated analytics views surface real course, assessment, progress, and cohort data. They are designed to support review and intervention without promising outcomes the data has not established.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <article className="rounded-lg border border-outline-variant bg-surface p-5"><span className="material-symbols-outlined text-tertiary" aria-hidden="true">insights</span><h3 className="mt-3 font-headline-sm text-headline-sm">Student performance</h3><p className="mt-2 font-body-md text-body-md text-on-surface-variant">Review quiz attempts, average performance, weak topics, and recommendations available for the signed-in student.</p></article>
                <article className="rounded-lg border border-outline-variant bg-surface p-5"><span className="material-symbols-outlined text-secondary" aria-hidden="true">monitoring</span><h3 className="mt-3 font-headline-sm text-headline-sm">Faculty analytics</h3><p className="mt-2 font-body-md text-body-md text-on-surface-variant">Review course enrollments, materials, published quizzes, and cohort quiz performance from the faculty analytics view.</p></article>
                <article className="rounded-lg border border-outline-variant bg-surface p-5 sm:col-span-2"><span className="material-symbols-outlined text-primary" aria-hidden="true">fact_check</span><h3 className="mt-3 font-headline-sm text-headline-sm">A reviewable academic record</h3><p className="mt-2 max-w-2xl font-body-md text-body-md text-on-surface-variant">The product presents data returned by its API-backed dashboards, including empty states when there is not yet enough activity to show a signal.</p></article>
              </div>
            </div>
          </div>
        </section>

        <section id="faculty" className="scroll-mt-20 border-b border-outline-variant/50 bg-surface py-20" aria-labelledby="faculty-heading">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10 max-w-2xl"><span className="font-label-sm text-label-sm uppercase tracking-[0.16em] text-primary">Faculty Tools</span><h2 id="faculty-heading" className="mt-2 font-headline-xl text-headline-xl">Course operations with an instructional focus.</h2><p className="mt-3 font-body-lg text-body-lg text-on-surface-variant">Faculty workspaces support the course lifecycle already represented in the application: create courses, manage materials, publish assessments, review submissions, and inspect cohort signals.</p></div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[{ icon: "library_add", title: "Course management", copy: "Create and maintain the courses assigned to an instructional workspace." }, { icon: "upload_file", title: "Material management", copy: "Upload and organize course documents used by the learning experience." }, { icon: "auto_awesome", title: "Quiz authoring", copy: "Use the quiz generator flow to prepare assessments from course materials." }, { icon: "grading", title: "Review and analytics", copy: "Review assignment work and inspect available student and course metrics." }].map((item) => <article key={item.title} className="rounded-lg border border-outline-variant bg-surface-container-lowest p-5"><span className="material-symbols-outlined text-primary" aria-hidden="true">{item.icon}</span><h3 className="mt-4 font-headline-sm text-headline-sm">{item.title}</h3><p className="mt-2 font-body-md text-body-md text-on-surface-variant">{item.copy}</p></article>)}
            </div>
            <Link href="/login" className="mt-7 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-container focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-hidden">Sign in for faculty tools <span className="material-symbols-outlined text-[17px]" aria-hidden="true">arrow_forward</span></Link>
          </div>
        </section>

        <section id="security" className="scroll-mt-20 border-b border-outline-variant/50 bg-surface-container-lowest py-20" aria-labelledby="security-heading">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10 max-w-2xl"><span className="font-label-sm text-label-sm uppercase tracking-[0.16em] text-primary">Governance</span><h2 id="security-heading" className="mt-2 font-headline-xl text-headline-xl">Role-aware access for academic work.</h2><p className="mt-3 font-body-lg text-body-lg text-on-surface-variant">Public registration and authenticated workspaces are separated by role. Students, faculty, and administrators see the routes and records intended for their account.</p></div>
            <div className="grid gap-4 md:grid-cols-3">
              {[{ role: "Student", copy: "Access enrolled courses, materials, assessments, personal performance views, recommendations, and the AI Tutor." }, { role: "Faculty", copy: "Manage instructional courses and materials, work with assessments, review submissions, and view cohort analytics." }, { role: "Administrator", copy: "Use the protected administrative console for user, faculty, student, and course catalog oversight." }].map((item) => <article key={item.role} className="rounded-lg border border-outline-variant bg-surface p-5"><h3 className="font-headline-sm text-headline-sm">{item.role}</h3><p className="mt-2 font-body-md text-body-md text-on-surface-variant">{item.copy}</p><span className="mt-5 inline-flex items-center gap-1.5 font-label-sm text-label-sm text-secondary"><span className="material-symbols-outlined text-[15px]" aria-hidden="true">verified_user</span>Role-based workspace</span></article>)}
            </div>
          </div>
        </section>

        <section className="bg-primary py-16 text-on-primary sm:py-20" aria-labelledby="cta-heading">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8"><h2 id="cta-heading" className="font-headline-xl text-headline-xl">Ready to enter your academic workspace?</h2><p className="mx-auto mt-3 max-w-xl font-body-lg text-body-lg text-on-primary/80">Sign in to use the course, assessment, analytics, and AI support tools available to your role.</p><div className="mt-7 flex flex-wrap justify-center gap-3"><Link href="/login" className="rounded-md bg-surface-container-lowest px-5 py-3 text-sm font-semibold text-primary transition-colors hover:bg-surface-container focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary focus-visible:outline-hidden">Sign In</Link><Link href="/register" className="rounded-md border border-primary-fixed-dim bg-primary-container px-5 py-3 text-sm font-semibold text-on-primary transition-colors hover:bg-primary/80 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary focus-visible:outline-hidden">Create Account</Link></div></div>
        </section>
      </main>

      <footer className="border-t border-outline/30 bg-inverse-surface py-8 text-inverse-on-surface">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8"><span className="font-headline-sm text-headline-sm font-bold">AURA LMS</span><span className="font-label-sm text-label-sm text-outline-variant">Academic learning workspace • Public preview</span></div>
      </footer>
    </div>
  );
}
