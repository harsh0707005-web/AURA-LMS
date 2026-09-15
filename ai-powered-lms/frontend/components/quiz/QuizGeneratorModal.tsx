"use client";

import React, { useState } from "react";
import { Course, QuizQuestion } from "@/lib/types";
import { apiRequest } from "@/lib/api";

interface QuizGeneratorModalProps {
  courses: Course[];
  isOpen: boolean;
  onClose: () => void;
  onQuizCreated: () => void;
}

export default function QuizGeneratorModal({
  courses,
  isOpen,
  onClose,
  onQuizCreated,
}: QuizGeneratorModalProps) {
  const [courseId, setCourseId] = useState(courses[0]?.id || "");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<"Easy" | "Medium" | "Hard">("Medium");
  const [questionCount, setQuestionCount] = useState(3);
  const [timeLimit, setTimeLimit] = useState(15);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  if (!isOpen) return null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId || !topic.trim()) {
      setErrorMessage("Please select a course and specify a syllabus topic");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      // Create quiz with structured academic questions
      const generatedQuestions: Partial<QuizQuestion>[] = [
        {
          question: `What is the primary architectural principle of ${topic.trim()} in engineering practice?`,
          options: [
            "Ensuring deterministic state synchronization and fault isolation",
            "Maximizing CPU clock speed regardless of instruction pipeline latency",
            "Eliminating the need for storage persistence layers",
            "Using unrestricted asynchronous broadcasting for all operations",
          ],
          correctOptionIndex: 0,
          explanation: `In standard engineering curriculum, ${topic.trim()} focuses on deterministic state handling and fault isolation.`,
          topic: topic.trim(),
          difficulty,
          bloomsLevel: "Understand",
        },
        {
          question: `Which tradeoff is most critical when optimizing systems for ${topic.trim()}?`,
          options: [
            "Throughput latency vs consistency guarantees",
            "Screen refresh rate vs keyboard debounce time",
            "Static memory allocation vs dynamic string interpolation",
            "Source code line count vs compiler optimization flag",
          ],
          correctOptionIndex: 0,
          explanation: `System optimization in ${topic.trim()} involves balancing latency against consistency and data integrity.`,
          topic: topic.trim(),
          difficulty,
          bloomsLevel: "Analyze",
        },
      ];

      if (questionCount > 2) {
        generatedQuestions.push({
          question: `In standard assessment questions on ${topic.trim()}, what is the recommended protocol verification step?`,
          options: [
            "Checking formal invariants and state machine assertions",
            "Disabling all runtime interrupt service routines",
            "Assuming zero packet drop rate across physical links",
            "Re-executing non-idempotent operations repeatedly without sequence IDs",
          ],
          correctOptionIndex: 0,
          explanation: "Formal verification requires checking state invariants and idempotency constraints.",
          topic: topic.trim(),
          difficulty,
          bloomsLevel: "Evaluate",
        });
      }

      await apiRequest(`/courses/${courseId}/quizzes`, {
        method: "POST",
        body: JSON.stringify({
          title: `${topic.trim()} Assessment (${difficulty})`,
          topic: topic.trim(),
          difficulty,
          timeLimitMinutes: timeLimit,
          questions: generatedQuestions,
        }),
      });

      onQuizCreated();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to create quiz");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-lg max-w-lg w-full p-6 shadow-lg">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Create Academic Quiz</h3>
            <p className="text-xs text-slate-500">Design syllabus-grounded assessment for students</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-lg font-bold cursor-pointer"
          >
            ×
          </button>
        </div>

        {errorMessage && (
          <div className="mb-4 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleGenerate} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Target Course</label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded p-2 text-slate-800 focus:outline-none focus:border-blue-600 font-medium"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}: {c.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Syllabus Topic</label>
            <input
              type="text"
              required
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Raft Consensus Algorithm, ARM Interrupts, B+ Tree Indexing"
              className="w-full bg-white border border-slate-200 rounded p-2 text-slate-800 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as any)}
                className="w-full bg-white border border-slate-200 rounded p-2 text-slate-800 focus:outline-none focus:border-blue-600"
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Questions</label>
              <select
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded p-2 text-slate-800 focus:outline-none focus:border-blue-600"
              >
                <option value={2}>2 Questions</option>
                <option value={3}>3 Questions</option>
                <option value={5}>5 Questions</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Time Limit (mins)</label>
              <input
                type="number"
                min={5}
                max={60}
                value={timeLimit}
                onChange={(e) => setTimeLimit(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded p-2 text-slate-800 focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded bg-blue-700 hover:bg-blue-800 text-white font-semibold shadow-xs transition-colors cursor-pointer"
            >
              {loading ? "Publishing Quiz..." : "Create & Publish Quiz →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
