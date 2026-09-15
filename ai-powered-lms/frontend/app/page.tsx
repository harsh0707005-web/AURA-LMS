"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";

export default function LandingPage() {
  const { user, role, status } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* 1. Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-lg bg-blue-700 flex items-center justify-center text-white font-bold text-base shadow-xs">
              A
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-slate-900">
                AURA <span className="text-blue-700 text-sm font-semibold">LMS</span>
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center space-x-6 text-xs font-semibold text-slate-600">
            <a href="#overview" className="hover:text-blue-700 transition-colors">
              Platform Overview
            </a>
            <a href="#workflow" className="hover:text-blue-700 transition-colors">
              Student Workflow
            </a>
            <a href="#ai-tutor" className="hover:text-blue-700 transition-colors">
              AI Course Tutor
            </a>
            <a href="#analytics" className="hover:text-blue-700 transition-colors">
              Learning Analytics
            </a>
            <a href="#faculty" className="hover:text-blue-700 transition-colors">
              Faculty Tools
            </a>
            <a href="#security" className="hover:text-blue-700 transition-colors">
              Governance
            </a>
          </nav>

          <div className="flex items-center space-x-3">
            {status === "authenticated" && user ? (
              <>
                <span className="text-xs font-medium text-slate-600 hidden sm:inline">
                  {user.name}
                </span>
                <Link
                  href={
                    role === "FACULTY"
                      ? "/faculty"
                      : role === "ADMIN"
                      ? "/admin"
                      : "/student"
                  }
                  className="text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded-md shadow-xs transition-colors"
                >
                  {role === "FACULTY"
                    ? "Go to Faculty Portal →"
                    : role === "ADMIN"
                    ? "Admin Console →"
                    : "Student Workspace →"}
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-xs font-semibold text-slate-700 hover:text-slate-900 px-3 py-2 rounded-md hover:bg-slate-100 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded-md shadow-xs transition-colors"
                >
                  Create Account
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* 2. Hero Section */}
        <section className="py-20 sm:py-24 border-b border-slate-200 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center animate-slide-up">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200/80 text-blue-900 text-xs font-semibold mb-6 shadow-2xs">
              <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
              <span>Department of Computer Engineering • Academic Session 2026</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
              One learning workspace for courses, assessment and personalized academic support.
            </h1>

            <p className="mt-6 text-base sm:text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
              A serious university Learning Management System engineered with relational database rigor,
              course-grounded AI tutoring, diagnostic weak topic identification, and learning analytics.
            </p>

            <div className="mt-9 flex flex-wrap justify-center gap-3.5">
              <Link
                href="/student"
                className="btn-press bg-blue-700 hover:bg-blue-800 text-white font-semibold px-6 py-3 rounded text-xs shadow-xs transition-colors flex items-center space-x-1.5"
              >
                <span>Access Student Workspace</span>
                <span>→</span>
              </Link>
              <Link
                href="/faculty"
                className="btn-press bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-semibold px-6 py-3 rounded text-xs transition-colors"
              >
                Faculty Portal
              </Link>
              <Link
                href="/admin"
                className="btn-press bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-5 py-3 rounded text-xs transition-colors"
              >
                Admin Console
              </Link>
            </div>
          </div>
        </section>

        {/* 3. What the LMS Solves */}
        <section id="overview" className="py-16 border-b border-slate-200 bg-slate-50/70">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Built for Academic Rigor and Engineering Focus</h2>
              <p className="text-xs text-slate-600 mt-2">
                Traditional LMS platforms act as passive file repositories. AURA LMS transforms coursework into an active, data-driven learning cycle.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="card-interactive p-6 flex flex-col justify-between">
                <div>
                  <div className="text-2xl mb-3 h-10 w-10 rounded-lg bg-blue-50 border border-blue-200/60 flex items-center justify-center">🎯</div>
                  <h3 className="text-sm font-bold text-slate-900 mb-2">Automated Weak Topic Diagnostics</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Every quiz attempt evaluates answer correctness and tags conceptual gaps, pinpointing exact syllabus subtopics needing reinforcement.
                  </p>
                </div>
              </div>

              <div className="card-interactive p-6 flex flex-col justify-between">
                <div>
                  <div className="text-2xl mb-3 h-10 w-10 rounded-lg bg-blue-50 border border-blue-200/60 flex items-center justify-center">📑</div>
                  <h3 className="text-sm font-bold text-slate-900 mb-2">Contextually Grounded AI Tutoring</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    AI explanations are anchored directly in official course lecture notes and unit documents rather than generic internet search results.
                  </p>
                </div>
              </div>

              <div className="card-interactive p-6 flex flex-col justify-between">
                <div>
                  <div className="text-2xl mb-3 h-10 w-10 rounded-lg bg-blue-50 border border-blue-200/60 flex items-center justify-center">📈</div>
                  <h3 className="text-sm font-bold text-slate-900 mb-2">Early Intervention Risk Analytics</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Faculty receive automated diagnostic alerts identifying at-risk students before midterm evaluations based on quiz trends and module progress.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Student Learning Workflow */}
        <section id="workflow" className="py-16 border-b border-slate-200 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-700">Closed-Loop Learning</span>
              <h2 className="text-2xl font-bold text-slate-900 mt-1">The 4-Step Academic Mastery Cycle</h2>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { step: "01", title: "Study Course Notes", desc: "Access official course modules, slides, and syllabus documents." },
                { step: "02", title: "Take Quizzes & Labs", desc: "Attempt timed interactive assessments with automatic evaluation." },
                { step: "03", title: "Diagnose Weak Topics", desc: "View diagnostic analytics identifying exact conceptual mistakes." },
                { step: "04", title: "Targeted Reinforcement", desc: "Consult the AI Tutor and practice recommended retest topics." },
              ].map((item) => (
                <div key={item.step} className="border border-slate-200 rounded-lg p-5 bg-slate-50/50">
                  <div className="text-xs font-bold text-blue-700 mb-2 font-mono">{item.step}</div>
                  <h3 className="text-sm font-bold text-slate-900 mb-1">{item.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5. AI Tutor Section */}
        <section id="ai-tutor" className="py-16 border-b border-slate-200 bg-slate-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-700">Academic AI Tutor</span>
                <h2 className="text-2xl font-bold text-slate-900 mt-1 mb-4">
                  Grounded in your department's actual syllabus materials
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  Unlike public AI chatbots that hallucinate or answer outside the academic curriculum, AURA LMS's AI Tutor is grounded in approved course documents.
                </p>

                <div className="space-y-3 text-xs text-slate-700">
                  <div className="flex items-start space-x-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span>Document page and unit citations on every answer</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span>Algorithmic breakdowns with engineering formulas</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span>Suggested diagnostic follow-ups for exam preparation</span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
                <div className="text-xs font-bold text-slate-800 pb-2 border-b border-slate-100 flex items-center justify-between">
                  <span>CS-401: Distributed Systems Q&A</span>
                  <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-semibold">Grounded</span>
                </div>
                <div className="mt-3 space-y-3 text-xs">
                  <div className="bg-blue-50/70 text-blue-950 p-2.5 rounded">
                    <strong>Student:</strong> How does Raft handle a network partition?
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-2.5 rounded text-slate-800">
                    <strong>AI Tutor:</strong> In Raft, a leader requires a majority quorum (N/2 + 1) to commit log entries. The isolated minority partition cannot elect a leader or commit entries, preventing split-brain anomalies.
                    <div className="mt-2 text-[10px] text-slate-500 pt-1.5 border-t border-slate-200">
                      📄 Citation: <em>CS401_Unit2_Consensus.pdf (Page 18)</em>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Personalized Learning */}
        <section id="analytics" className="py-16 border-b border-slate-200 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-700">Diagnostic Analytics</span>
              <h2 className="text-2xl font-bold text-slate-900 mt-1">Real-Time Performance Diagnostics</h2>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="border border-slate-200 rounded-lg p-5 bg-white">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Weak Topic Detection</div>
                <h4 className="text-base font-bold text-slate-900 mb-1">Interrupt Service Routines</h4>
                <div className="text-xs text-rose-700 font-semibold mb-2">Critical Need (Score: 50%)</div>
                <p className="text-xs text-slate-600">Generated from Embedded Systems Assessment (ARM NVIC questions).</p>
              </div>

              <div className="border border-slate-200 rounded-lg p-5 bg-white">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Automated Recommendation</div>
                <h4 className="text-base font-bold text-slate-900 mb-1">Priority Inversion Review Note</h4>
                <div className="text-xs text-blue-700 font-semibold mb-2">15 Min Study Target</div>
                <p className="text-xs text-slate-600">Curated review material focused on mutex inheritance protocols.</p>
              </div>

              <div className="border border-slate-200 rounded-lg p-5 bg-white">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Diagnostic Retest</div>
                <h4 className="text-base font-bold text-slate-900 mb-1">Targeted 3-Question Retest</h4>
                <div className="text-xs text-emerald-700 font-semibold mb-2">Mastery Check</div>
                <p className="text-xs text-slate-600">Adaptive retest to verify conceptual recovery before final exam.</p>
              </div>
            </div>
          </div>
        </section>

        {/* 7. Learning Analytics & 8. Faculty Tools */}
        <section id="faculty" className="py-16 border-b border-slate-200 bg-slate-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-700">Faculty Hub</span>
                <h2 className="text-2xl font-bold text-slate-900 mt-1 mb-3">
                  Comprehensive Course Management & Predictive Risk Detection
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  Faculty members have full control over course syllabi, materials, assignments, and test generation with automated at-risk student detection.
                </p>

                <ul className="space-y-2 text-xs text-slate-700">
                  <li className="flex items-center space-x-2">
                    <span className="text-blue-700 font-bold">•</span>
                    <span>Course creation with module breakdown and syllabus uploads</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className="text-blue-700 font-bold">•</span>
                    <span>Assignment grading with rubric scoring and inline feedback</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className="text-blue-700 font-bold">•</span>
                    <span>Interactive quiz authoring mapped to Bloom's taxonomy</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <span className="text-blue-700 font-bold">•</span>
                    <span>Cohort analytics and intervention recommendation tracking</span>
                  </li>
                </ul>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
                <div className="text-xs font-bold text-slate-900 mb-3 flex items-center justify-between">
                  <span>At-Risk Student Diagnostic Table</span>
                  <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-semibold">Faculty Alert</span>
                </div>
                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 text-[10px] uppercase">
                        <th className="pb-1.5">Student</th>
                        <th className="pb-1.5">Course</th>
                        <th className="pb-1.5">Avg Score</th>
                        <th className="pb-1.5">Risk Level</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      <tr>
                        <td className="py-2 font-medium">Harsh Vardhan</td>
                        <td className="py-2">CS-402</td>
                        <td className="py-2 font-semibold">50%</td>
                        <td className="py-2"><span className="text-[10px] bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded font-bold">HIGH</span></td>
                      </tr>
                      <tr>
                        <td className="py-2 font-medium">Ananya Roy</td>
                        <td className="py-2">CS-402</td>
                        <td className="py-2 font-semibold">35%</td>
                        <td className="py-2"><span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-bold">MEDIUM</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 9. Security & Roles */}
        <section id="security" className="py-16 border-b border-slate-200 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-700">Security Architecture</span>
            <h2 className="text-2xl font-bold text-slate-900 mt-1 mb-8">Role-Based Access Control & Academic Governance</h2>

            <div className="grid md:grid-cols-3 gap-6 text-left">
              <div className="border border-slate-200 rounded-lg p-5 bg-slate-50">
                <div className="text-xs font-bold text-slate-900 mb-1">Student Role</div>
                <p className="text-xs text-slate-600 mb-3">Enrolled courses, course materials, assignment submissions, quiz attempts, personal performance analytics, and AI Tutor.</p>
                <div className="text-[11px] text-blue-700 font-semibold">Public Registration Available</div>
              </div>

              <div className="border border-slate-200 rounded-lg p-5 bg-slate-50">
                <div className="text-xs font-bold text-slate-900 mb-1">Faculty Role</div>
                <p className="text-xs text-slate-600 mb-3">Course creation, materials management, assignment evaluation, quiz generation, and student cohort risk analytics.</p>
                <div className="text-[11px] text-blue-700 font-semibold">Public Registration Available</div>
              </div>

              <div className="border border-slate-200 rounded-lg p-5 bg-slate-50">
                <div className="text-xs font-bold text-slate-900 mb-1">Administrator Role</div>
                <p className="text-xs text-slate-600 mb-3">User account management, faculty/student directories, catalog oversight, system database health monitoring.</p>
                <div className="text-[11px] text-rose-700 font-semibold">Protected (Seed / Admin Invite Only)</div>
              </div>
            </div>
          </div>
        </section>

        {/* 10. Call to Action */}
        <section className="py-16 bg-blue-900 text-white text-center">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-extrabold tracking-tight">
              Ready to access your academic workspace?
            </h2>
            <p className="mt-3 text-sm text-blue-200 max-w-xl mx-auto">
              Sign in with your institutional credentials to continue your engineering coursework.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link
                href="/login"
                className="bg-white text-blue-900 hover:bg-blue-50 font-bold px-6 py-2.5 rounded-md text-xs transition-colors"
              >
                Sign In Now
              </Link>
              <Link
                href="/register"
                className="bg-blue-800 hover:bg-blue-700 text-white border border-blue-600 font-bold px-6 py-2.5 rounded-md text-xs transition-colors"
              >
                Create Account
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* 11. Footer */}
      <footer className="bg-slate-900 text-slate-400 py-8 border-t border-slate-800 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-white">AURA LMS</span>
            <span>— AI-powered University Resource & Academic Learning System</span>
          </div>
          <div className="text-[11px] text-slate-500">
            Final Year B.E. Computer Engineering Capstone Project • Academic Session 2026
          </div>
        </div>
      </footer>
    </div>
  );
}
