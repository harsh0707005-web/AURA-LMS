"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { AIMessage, Course } from "@/lib/types";
import { apiRequest } from "@/lib/api";

interface AIChatBoxProps {
  courseId?: string;
  courses?: Course[];
}

export default function AIChatBox({ courseId, courses = [] }: AIChatBoxProps) {
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courseId || "");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: "welcome-msg",
      sender: "assistant",
      content:
        "Hello! I am your course AI academic tutor. You can ask me to clarify concepts, explain syllabus topics, provide mathematical derivations, or guide your preparation grounded in uploaded lecture notes.",
      suggestedFollowUps: [
        "Explain how randomized election timeouts prevent split votes in Raft",
        "What are the main tradeoffs between B+ Trees and LSM Trees in databases?",
        "How does NVIC prioritize nested interrupts in ARM Cortex-M architecture?",
      ],
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (courseId) {
      setSelectedCourseId(courseId);
    } else if (courses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courseId, courses, selectedCourseId]);

  const handleCourseChange = (newCourseId: string) => {
    setSelectedCourseId(newCourseId);
    setConversationId(null);
    setErrorBanner(null);
    const selectedCourse = courses.find((c) => c.id === newCourseId);
    setMessages([
      {
        id: `welcome-${newCourseId}`,
        sender: "assistant",
        content: `Switched to ${selectedCourse?.code || "Course"}: ${selectedCourse?.title || "Academic Syllabus"}. Ask any question grounded in the lecture documents for this course.`,
        suggestedFollowUps: [
          `Explain the key architecture principles of ${selectedCourse?.code || "this course"}`,
          `What are the most important examination topics for this unit?`,
        ],
      },
    ]);
  };

  const handleNewSession = () => {
    setConversationId(null);
    setErrorBanner(null);
    const selectedCourse = courses.find((c) => c.id === selectedCourseId);
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: "assistant",
        content: `Started a fresh academic session for ${selectedCourse?.code || "this course"}. How can I assist your study today?`,
        suggestedFollowUps: [
          "Explain how randomized election timeouts prevent split votes in Raft",
          "What are the main tradeoffs between B+ Trees and LSM Trees in databases?",
          "How does NVIC prioritize nested interrupts in ARM Cortex-M architecture?",
        ],
      },
    ]);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    setErrorBanner(null);
    const userMessage: AIMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      content: text.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      // 1. Create or use active conversation
      let activeConvoId = conversationId;
      if (!activeConvoId) {
        const convoRes = await apiRequest<{ id: string }>("/ai/conversations", {
          method: "POST",
          body: JSON.stringify({
            courseId: selectedCourseId || undefined,
            title: `Q&A: ${text.slice(0, 30)}...`,
          }),
        });
        activeConvoId = convoRes.data.id;
        setConversationId(activeConvoId);
      }

      // 2. Post message to backend with RAG retrieval
      const res = await apiRequest<{
        userMessage: any;
        assistantMessage: AIMessage;
      }>(`/ai/conversations/${activeConvoId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: text.trim() }),
      });

      if (res.data?.assistantMessage) {
        setMessages((prev) => [...prev, res.data.assistantMessage]);
      }
    } catch (err: any) {
      console.error("AI Tutor error:", err);
      const errMsg = err?.message || "Failed to communicate with AI Tutor server";
      setErrorBanner(errMsg);

      const fallbackAssistantMessage: AIMessage = {
        id: `assistant-${Date.now()}`,
        sender: "assistant",
        content: `I encountered an issue processing that query: ${errMsg}. Please ensure you are enrolled in the course with uploaded documents and try again.`,
        sources: [],
        suggestedFollowUps: [
          "Can you explain the main topics in this course?",
        ],
      };
      setMessages((prev) => [...prev, fallbackAssistantMessage]);
    } finally {
      setLoading(false);
    }
  };

  const hasNoCourses = courses.length === 0 && !courseId;

  return (
    <div className="bg-white border border-slate-200 rounded-xl flex flex-col h-[650px] shadow-xs overflow-hidden transition-all duration-200">
      {/* Header with Course Grounding */}
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shadow-2xs font-bold text-sm">
            AI
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-xs font-bold text-slate-900 leading-none">Course AI Academic Tutor</h3>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse"></span>
                RAG Active
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-medium">
              Real-Time Vector RAG grounded in course syllabus & lecture notes
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {courses.length > 0 && (
            <select
              value={selectedCourseId}
              onChange={(e) => handleCourseChange(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-blue-600 font-medium shadow-2xs transition-colors"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}: {c.title.slice(0, 26)}...
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={handleNewSession}
            title="Start a new chat thread"
            className="text-[11px] px-3 py-1.5 bg-white hover:bg-slate-50 active:scale-95 border border-slate-200 text-slate-700 rounded-lg font-semibold transition-all shadow-2xs cursor-pointer btn-press"
          >
            + New Thread
          </button>
        </div>
      </div>

      {/* No Courses Enrolled Warning */}
      {hasNoCourses && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-[11px] text-amber-800 flex items-center justify-between">
          <span>⚠️ You are not enrolled in any courses yet. Enroll in a course for grounded answers.</span>
          <Link href="/student/courses" className="font-bold text-amber-900 underline ml-2 shrink-0">
            Browse Courses →
          </Link>
        </div>
      )}

      {/* Error alert banner */}
      {errorBanner && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 text-[11px] text-rose-700 flex items-center justify-between animate-fade-in">
          <span>⚠️ {errorBanner}</span>
          <button onClick={() => setErrorBanner(null)} className="font-bold text-rose-800 ml-2 hover:text-rose-900">×</button>
        </div>
      )}

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
          >
            <div className="flex items-start space-x-2 max-w-[85%]">
              {msg.sender === "assistant" && (
                <div className="w-7 h-7 rounded-lg bg-blue-900 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 shadow-xs">
                  AI
                </div>
              )}
              <div
                className={`rounded-xl p-4 text-xs leading-relaxed transition-all shadow-2xs ${
                  msg.sender === "user"
                    ? "bg-blue-700 text-white rounded-tr-xs"
                    : "bg-slate-50 border border-slate-200 text-slate-800 rounded-tl-xs"
                }`}
              >
                <div className="whitespace-pre-wrap font-sans">{msg.content}</div>

                {/* Grounded Citations with Similarity Badges */}
                {msg.sender === "assistant" && msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3.5 pt-3 border-t border-slate-200/80">
                    <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                      <span>📑</span>
                      <span>Verified Course References ({msg.sources.length})</span>
                    </div>
                    <div className="space-y-2">
                      {msg.sources.map((src, i) => (
                        <div
                          key={i}
                          className="bg-white border border-slate-200 rounded-lg p-2.5 text-[11px] text-slate-700 shadow-2xs card-interactive"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-blue-950">
                              {src.documentName}
                            </span>
                            <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-mono font-medium">
                              {src.score ? `${Math.round(src.score * 100)}% match` : "Verified"}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 mb-1">
                            {src.unit} {src.page ? `• Page ${src.page}` : ""}
                          </div>
                          {src.excerpt && (
                            <div className="text-[10px] text-slate-600 bg-slate-50/90 p-2 rounded border border-slate-100 italic">
                              &quot;{src.excerpt}&quot;
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Follow-up Prompts */}
                {msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && (
                  <div className="mt-3.5 pt-2.5 border-t border-slate-200/60">
                    <div className="text-[10px] font-semibold text-slate-500 mb-2">
                      Suggested Questions:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.suggestedFollowUps.map((q, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSend(q)}
                          className="text-[11px] text-left bg-white border border-slate-200 hover:border-blue-600 hover:bg-blue-50/40 text-slate-700 hover:text-blue-800 px-2.5 py-1 rounded-md transition-all cursor-pointer btn-press"
                        >
                          {q} →
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {msg.sender === "user" && (
                <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  YOU
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start animate-fade-in">
            <div className="flex items-start space-x-2 max-w-[85%]">
              <div className="w-7 h-7 rounded-lg bg-blue-900 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                AI
              </div>
              <div className="bg-slate-50 border border-slate-200 text-slate-600 rounded-xl rounded-tl-xs p-4 text-xs flex items-center space-x-3 shadow-2xs">
                <div className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: "0ms" }}></span>
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: "150ms" }}></span>
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: "300ms" }}></span>
                </div>
                <span className="font-medium text-slate-500">Searching course vectors & synthesizing grounded answer...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-3.5 border-t border-slate-200 bg-slate-50/60 flex items-center space-x-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question grounded in this course syllabus..."
          className="flex-1 bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs transition-all"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="bg-blue-700 hover:bg-blue-800 active:scale-95 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-lg text-xs transition-all cursor-pointer shrink-0 shadow-xs btn-press"
        >
          Send
        </button>
      </form>
    </div>
  );
}

