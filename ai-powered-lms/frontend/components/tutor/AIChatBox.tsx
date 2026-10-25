"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  AIConversation,
  AIMessage,
  AIMessageDeliveryStatus,
  AITutorMessageStatusResponse,
  AITutorResponse,
  Course,
} from "@/lib/types";
import { apiRequest } from "@/lib/api";

// Keep the client window above the backend's normal/complex generation
// budgets so a slow but bounded provider request is not shown as a client
// failure while the server is still working.
const AI_REQUEST_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_AI_REQUEST_TIMEOUT_MS) || 125_000;
const AI_MESSAGE_STATUS_POLL_INTERVAL_MS = 2_000;
const AI_MESSAGE_STATUS_MAX_POLLS = 30;
const WEBSITE_SUGGESTIONS = [
  "What courses am I currently enrolled in?",
  "What are my current weak topics?",
  "Why were these topics identified as weak areas?",
  "How is my progress across enrolled courses?",
  "What is my average quiz score?",
  "Which assignments have I submitted?",
  "What assignments or deadlines should I focus on?",
  "Which course should I study next?",
  "Create a study plan for my weak topics.",
  "What course materials should I review next?",
  "How can I use the AI Tutor effectively?",
  "What can I do in the AURA LMS website?",
];

type PendingTutorMessage = {
  key: string;
  text: string;
  conversationId: string | null;
};

function createClientMessageKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `ai-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function normalizeDeliveryStatus(status: unknown): AIMessageDeliveryStatus {
  switch (String(status || "").toLowerCase()) {
    case "completed":
    case "complete":
    case "succeeded":
    case "success":
      return "completed";
    case "failed":
    case "failure":
    case "error":
      return "failed";
    case "retrying":
    case "retry":
    case "in_progress":
    case "in-progress":
      return "retrying";
    default:
      return "processing";
  }
}

function deliveryStatusLabel(status: AIMessageDeliveryStatus | null): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "retrying":
      return "Retrying safely…";
    case "failed":
      return "Failed — retry available";
    default:
      return "Processing…";
  }
}

interface AIChatBoxProps {
  courseId?: string;
  courses?: Course[];
  mode?: "compact" | "full";
}

export default function AIChatBox({
  courseId,
  courses = [],
  mode = "compact",
}: AIChatBoxProps) {
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courseId || "");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: "welcome-msg",
      sender: "assistant",
      content:
        "Hello! I am your course AI academic tutor. You can ask me to clarify concepts, explain syllabus topics, provide mathematical derivations, or guide your preparation grounded strictly in uploaded lecture notes.",
      suggestedFollowUps: WEBSITE_SUGGESTIONS,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(mode === "full");
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [messageStatus, setMessageStatus] = useState<AIMessageDeliveryStatus | null>(null);
  const [pendingMessageKey, setPendingMessageKey] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageSequence = useRef(0);
  const pendingMessageRef = useRef<PendingTutorMessage | null>(null);
  const completedMessageKeysRef = useRef<Set<string>>(new Set());
  const activeRequestRef = useRef<AbortController | null>(null);
  const activePollRef = useRef<AbortController | null>(null);

  // Load conversation list asynchronously in full mode
  const refreshConversations = useCallback(async () => {
    if (mode !== "full") return;
    try {
      const res = await apiRequest<AIConversation[]>("/ai/conversations");
      if (res.success && res.data) {
        setConversations(res.data);
      }
    } catch (err) {
      console.warn("Could not load past conversations:", err);
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== "full") return;
    let isMounted = true;
    apiRequest<AIConversation[]>("/ai/conversations")
      .then((res) => {
        if (isMounted && res.success && res.data) {
          setConversations(res.data);
        }
      })
      .catch((err) => {
        console.warn("Could not load past conversations:", err);
      })
      .finally(() => {
        if (isMounted) setLoadingConversations(false);
      });

    return () => {
      isMounted = false;
    };
  }, [mode]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleCourseChange = (newCourseId: string) => {
    activeRequestRef.current?.abort();
    activePollRef.current?.abort();
    pendingMessageRef.current = null;
    setPendingMessageKey(null);
    setSelectedCourseId(newCourseId);
    setConversationId(null);
    setErrorBanner(null);
    setMessageStatus(null);
    const selectedCourse = courses.find((c) => c.id === newCourseId);
    setMessages([
      {
        id: `welcome-${newCourseId}`,
        sender: "assistant",
        content: `Switched to ${selectedCourse?.code || "Course"}: ${
          selectedCourse?.title || "Academic Syllabus"
        }. Ask any question grounded in the lecture documents for this course.`,
        suggestedFollowUps: WEBSITE_SUGGESTIONS,
      },
    ]);
  };

  const handleNewSession = () => {
    activeRequestRef.current?.abort();
    activePollRef.current?.abort();
    pendingMessageRef.current = null;
    setPendingMessageKey(null);
    setConversationId(null);
    setErrorBanner(null);
    setMessageStatus(null);
    const selectedCourse = courses.find((c) => c.id === activeCourseId);
    setMessages([
      {
        id: `welcome-${++messageSequence.current}`,
        sender: "assistant",
        content: `Started a fresh academic session for ${
          selectedCourse?.code || "this course"
        }. How can I assist your study today?`,
        suggestedFollowUps: WEBSITE_SUGGESTIONS,
      },
    ]);
  };

  const handleSelectConversation = async (convoId: string) => {
    try {
      setLoading(true);
      setErrorBanner(null);
      const res = await apiRequest<AIConversation>(`/ai/conversations/${convoId}`);
      if (res.success && res.data) {
        setConversationId(res.data.id);
        if (res.data.courseId) setSelectedCourseId(res.data.courseId);
        if (res.data.messages && res.data.messages.length > 0) {
          setMessages(res.data.messages);
        } else {
          setMessages([
            {
              id: `convo-empty-${convoId}`,
              sender: "assistant",
              content: `Loaded session: ${res.data.title}. No messages yet.`,
            },
          ]);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load conversation";
      setErrorBanner(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConversation = async (e: React.MouseEvent, convoId: string) => {
    e.stopPropagation();
    try {
      await apiRequest(`/ai/conversations/${convoId}`, { method: "DELETE" });
      setConversations((prev) => prev.filter((c) => c.id !== convoId));
      if (conversationId === convoId) {
        handleNewSession();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete conversation";
      setErrorBanner(msg);
    }
  };

  const handleCopyContent = (msgId: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const updateMessageStatus = (key: string, status: AIMessageDeliveryStatus) => {
    setMessageStatus(status);
    setMessages((prev) =>
      prev.map((message) =>
        message.clientMessageId === key ? { ...message, deliveryStatus: status } : message
      )
    );
  };

  const appendReconciledAssistantMessage = (key: string, assistantMessage?: AIMessage) => {
    if (!assistantMessage || completedMessageKeysRef.current.has(key)) return false;

    const normalizedAssistantMessage: AIMessage = {
      ...assistantMessage,
      id: assistantMessage.id || `assistant-${key}`,
      clientMessageId: assistantMessage.clientMessageId || key,
      idempotencyKey: assistantMessage.idempotencyKey || key,
      deliveryStatus: "completed",
    };

    completedMessageKeysRef.current.add(key);
    setMessages((prev) => {
      const existingIndex = prev.findIndex(
        (message) =>
          message.sender === "assistant" &&
          (message.clientMessageId === key || message.id === normalizedAssistantMessage.id)
      );

      if (existingIndex === -1) return [...prev, normalizedAssistantMessage];

      return prev.map((message, index) =>
        index === existingIndex ? normalizedAssistantMessage : message
      );
    });
    updateMessageStatus(key, "completed");
    return true;
  };

  const getStatusPayload = (data: AITutorMessageStatusResponse) => {
    const possibleResult = data as AITutorMessageStatusResponse & {
      result?: AITutorMessageStatusResponse;
    };
    return possibleResult.result || data;
  };

  const pollMessageStatus = async (conversationIdToPoll: string, key: string) => {
    const pollController = new AbortController();
    activePollRef.current?.abort();
    activePollRef.current = pollController;

    try {
      for (let attempt = 0; attempt < AI_MESSAGE_STATUS_MAX_POLLS; attempt += 1) {
        if (pendingMessageRef.current?.key !== key) return false;

        try {
          const statusResponse = await apiRequest<AITutorMessageStatusResponse>(
            `/ai/conversations/${conversationIdToPoll}/messages/status/${encodeURIComponent(key)}`,
            {
              method: "GET",
              cache: "no-store",
              signal: pollController.signal,
            }
          );
          const statusData = getStatusPayload(statusResponse.data);
          const status = normalizeDeliveryStatus(statusData.status);
          updateMessageStatus(key, status);

          if (statusData.assistantMessage) {
            appendReconciledAssistantMessage(key, statusData.assistantMessage);
            return true;
          }

          if (status === "failed") {
            setErrorBanner(statusData.error || statusData.message || "The tutor could not complete this message.");
            return false;
          }
        } catch (error: unknown) {
          if (isAbortError(error)) throw error;
          // A transient status read should not change the logical message key.
          // Continue polling so a completed server-side request can still be recovered.
          if (attempt === AI_MESSAGE_STATUS_MAX_POLLS - 1) {
            setErrorBanner("The tutor is still unavailable. You can retry this message safely.");
            updateMessageStatus(key, "failed");
            return false;
          }
        }

        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, AI_MESSAGE_STATUS_POLL_INTERVAL_MS);
        });
      }
    } finally {
      if (activePollRef.current === pollController) activePollRef.current = null;
    }

    updateMessageStatus(key, "failed");
    setErrorBanner("The tutor is still unavailable. You can retry this message safely.");
    return false;
  };

  const submitLogicalMessage = async (pendingMessage: PendingTutorMessage) => {
    const requestController = new AbortController();
    activeRequestRef.current?.abort();
    activeRequestRef.current = requestController;
    const timeoutId = window.setTimeout(() => requestController.abort(), AI_REQUEST_TIMEOUT_MS);

    setErrorBanner(null);
    setLoading(true);
    updateMessageStatus(pendingMessage.key, "processing");

    try {
      let activeConvoId = pendingMessage.conversationId;
      if (!activeConvoId) {
        const convoRes = await apiRequest<{ id: string }>("/ai/conversations", {
          method: "POST",
          body: JSON.stringify({
            courseId: activeCourseId || undefined,
            title: `Q&A: ${pendingMessage.text.slice(0, 32)}...`,
          }),
          signal: requestController.signal,
        });
        activeConvoId = convoRes.data.id;
        pendingMessage.conversationId = activeConvoId;
        setConversationId(activeConvoId);
        refreshConversations();
      }

      const response = await apiRequest<AITutorResponse>(
        `/ai/conversations/${activeConvoId}/messages`,
        {
          method: "POST",
          headers: {
            "Idempotency-Key": pendingMessage.key,
            "X-Client-Message-Id": pendingMessage.key,
          },
          body: JSON.stringify({
            content: pendingMessage.text,
            idempotencyKey: pendingMessage.key,
            clientMessageId: pendingMessage.key,
          }),
          signal: requestController.signal,
        }
      );

      if (pendingMessageRef.current?.key === pendingMessage.key) {
        appendReconciledAssistantMessage(pendingMessage.key, response.data?.assistantMessage);
      }
    } catch (error: unknown) {
      if (pendingMessageRef.current?.key !== pendingMessage.key) return;
      // Starting a new thread or changing courses intentionally aborts the
      // previous request. The pending key is cleared by those handlers, so
      // ignore that expected cancellation instead of logging it as an error.
      console.error("AI Tutor error:", error);
      const timedOut = requestController.signal.aborted || isAbortError(error);

      if (timedOut && pendingMessage.conversationId) {
        updateMessageStatus(pendingMessage.key, "retrying");
        setErrorBanner("The tutor is still processing this message. Checking for the original result...");
        try {
          await pollMessageStatus(pendingMessage.conversationId, pendingMessage.key);
        } catch (pollError: unknown) {
          if (!isAbortError(pollError)) {
            updateMessageStatus(pendingMessage.key, "failed");
            setErrorBanner("The tutor status could not be checked. You can retry this message safely.");
          }
        }
      } else {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to communicate with AI Tutor server";
        updateMessageStatus(pendingMessage.key, "failed");
        setErrorBanner(errorMessage);
      }
    } finally {
      window.clearTimeout(timeoutId);
      if (activeRequestRef.current === requestController) activeRequestRef.current = null;
      setLoading(false);
    }
  };

  const handleRetry = async () => {
    const pendingMessage = pendingMessageRef.current;
    if (!pendingMessage || loading) return;
    await submitLogicalMessage(pendingMessage);
  };

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    const key = createClientMessageKey();
    const pendingMessage: PendingTutorMessage = {
      key,
      text: text.trim(),
      conversationId,
    };
    pendingMessageRef.current = pendingMessage;
    setPendingMessageKey(key);
    setMessageStatus("processing");

    const userMessage: AIMessage = {
      id: `user-${++messageSequence.current}`,
      sender: "user",
      content: pendingMessage.text,
      clientMessageId: key,
      idempotencyKey: key,
      deliveryStatus: "processing",
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    await submitLogicalMessage(pendingMessage);
  };

  const activeCourseId = courseId || selectedCourseId || courses[0]?.id || "";
  const hasNoCourses = courses.length === 0 && !courseId;
  const currentCourse = courses.find((c) => c.id === activeCourseId);
  const latestAssistantMessage = [...messages].reverse().find((m) => m.sender === "assistant");
  const activeSources = latestAssistantMessage?.sources || [];

  // ==========================================
  // COMPACT MODE (Rendered on Student Dashboard)
  // ==========================================
  if (mode === "compact") {
    return (
      <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl flex flex-col h-160 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-surface-container-high flex items-center justify-between bg-surface-container-low/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary-container text-on-primary flex items-center justify-center font-bold text-xs shadow-xs">
              <span className="material-symbols-outlined text-[18px]">smart_toy</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-headline-sm text-xs font-bold text-on-surface leading-none">
                  AI Course Tutor
                </h3>
                <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
              </div>
              <span className="font-label-sm text-[10px] text-outline leading-tight block mt-0.5">
                RAG Grounded Assistant
              </span>
            </div>
          </div>

          <Link
            href="/student/ai-tutor"
            className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
            title="Expand to Full Workspace"
            aria-label="Open Full Workspace"
          >
            <span className="material-symbols-outlined text-[18px]">open_in_new</span>
          </Link>
        </div>

        {/* Course Switcher */}
        {courses.length > 0 && (
          <div className="px-4 py-2 border-b border-surface-container-high bg-surface-container-low/40 flex items-center justify-between text-xs shrink-0">
            <select
              value={activeCourseId}
              onChange={(e) => handleCourseChange(e.target.value)}
              className="bg-surface-container-lowest border border-surface-container-high rounded-lg px-2 py-1 text-on-surface font-label-sm text-[11px] focus:outline-hidden focus:ring-1 focus:ring-primary max-w-52.5 truncate"
              aria-label="Select course context"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}: {c.title}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleNewSession}
              className="font-label-sm text-[11px] text-primary hover:underline flex items-center gap-0.5"
            >
              <span>+ New</span>
            </button>
          </div>
        )}

        {/* Error Alert */}
        {errorBanner && (
          <div className="bg-error-container text-on-error-container px-3 py-1.5 text-[11px] font-body-sm flex items-center justify-between shrink-0">
            <span className="truncate">⚠️ {errorBanner}</span>
            {messageStatus === "failed" && pendingMessageKey && (
              <button
                type="button"
                onClick={handleRetry}
                className="font-semibold underline ml-2 shrink-0"
              >
                Retry
              </button>
            )}
            <button
              type="button"
              onClick={() => setErrorBanner(null)}
              className="font-bold ml-2 text-on-error-container"
            >
              ×
            </button>
          </div>
        )}

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.sender === "user" ? "justify-end" : "justify-start"
              } animate-fade-in`}
            >
              <div
                className={`max-w-[88%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                  msg.sender === "user"
                    ? "bg-primary-container text-on-primary rounded-tr-xs"
                    : "bg-surface-container-low border border-surface-container-high text-on-surface rounded-tl-xs"
                }`}
                >
                <div className="whitespace-pre-wrap font-body-sm">{msg.content}</div>
                {msg.sender === "user" && msg.deliveryStatus && (
                  <div className="mt-2 border-t border-white/20 pt-1.5 text-[10px] font-semibold opacity-80">
                    {deliveryStatusLabel(msg.deliveryStatus)}
                  </div>
                )}

                {/* Citations Preview */}
                {msg.sender === "assistant" && msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-surface-container-high text-[10px] font-label-sm">
                    <span className="text-secondary font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">verified</span>
                      {msg.sources.length} Grounded Source{msg.sources.length > 1 ? "s" : ""}
                    </span>
                  </div>
                )}

                {/* Follow-up Prompts */}
                {msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-surface-container-high space-y-1">
                    {msg.suggestedFollowUps.slice(0, 2).map((q, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSend(q)}
                        className="w-full text-left font-body-sm text-[11px] p-1.5 rounded-lg bg-surface-container-lowest hover:bg-surface-container text-on-surface border border-surface-container-high transition-colors truncate block"
                      >
                        → {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start animate-fade-in">
              <div className="bg-surface-container-low border border-surface-container-high text-on-surface-variant rounded-2xl rounded-tl-xs p-3 text-xs flex items-center gap-2 font-label-sm text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                <span>{deliveryStatusLabel(messageStatus)}</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-3 border-t border-surface-container-high bg-surface-container-low/70 flex items-center gap-2 shrink-0"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a syllabus question..."
            className="flex-1 bg-surface-container-lowest border border-surface-container-high rounded-xl px-3 py-2 text-xs text-on-surface placeholder:text-outline focus:outline-hidden focus:ring-1 focus:ring-primary font-body-sm"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="p-2 rounded-xl bg-primary-container text-on-primary hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer shrink-0"
            aria-label="Send query"
          >
            <span className="material-symbols-outlined text-[16px]">send</span>
          </button>
        </form>
      </div>
    );
  }

  // ==========================================
  // FULL WORKSPACE MODE (Rendered on /student/ai-tutor)
  // ==========================================
  return (
    <div className="space-y-6">
      {/* Top Utility Control Bar */}
      <div className="w-full bg-surface-container-lowest rounded-2xl p-4 sm:p-5 shadow-sm border border-surface-container-high flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Left Context Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Active Course Selector */}
            <div className="relative inline-flex items-center">
              {courses.length > 0 ? (
                <div className="flex items-center gap-2 bg-linear-to-r from-primary to-primary-container text-on-primary px-3.5 py-1.5 rounded-xl shadow-xs">
                  <span className="material-symbols-outlined text-[18px]">school</span>
                  <select
                    value={activeCourseId}
                    onChange={(e) => handleCourseChange(e.target.value)}
                    className="bg-transparent text-on-primary font-headline-sm text-sm font-semibold outline-hidden cursor-pointer"
                    aria-label="Active Course Workspace"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id} className="text-on-surface bg-surface">
                        {c.code}: {c.title}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-surface-container-high text-on-surface-variant px-3 py-1.5 rounded-xl text-xs font-semibold">
                  <span className="material-symbols-outlined text-[18px]">school</span>
                  <span>General Academic Assistant</span>
                </div>
              )}
            </div>

            {/* RAG Grounding Radar */}
            <div className="flex items-center gap-2 bg-[#ecfdf5] border border-[#a7f3d0] px-3 py-1.5 rounded-xl text-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#059669]" />
              </span>
              <span className="font-label-md text-label-sm text-[#065f46] font-semibold">
                Strict Grounding Active
              </span>
            </div>
          </div>

          {/* Right Session Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleNewSession}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container-low hover:bg-surface-container border border-surface-container-high text-on-surface-variant font-label-md text-label-sm transition-colors cursor-pointer shadow-2xs"
            >
              <span className="material-symbols-outlined text-[16px] text-primary">add</span>
              <span>New Thread</span>
            </button>
          </div>
        </div>

        {/* Informational Subtext */}
        <div className="pt-2 border-t border-surface-container-high flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 font-body-sm text-on-surface-variant">
            <span className="material-symbols-outlined text-[16px] text-secondary">
              verified_user
            </span>
            <span>
              Grounding active across uploaded syllabus materials for{" "}
              <strong className="text-on-surface">
                {currentCourse ? currentCourse.code : "enrolled coursework"}
              </strong>
            </span>
          </div>
          <span className="font-label-sm text-[11px] text-outline">
            {messages.length} message{messages.length !== 1 ? "s" : ""} in thread
          </span>
        </div>
      </div>

      {/* No Courses Warning Banner */}
      {hasNoCourses && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-amber-700">warning</span>
            <span>You are not enrolled in any courses yet. Enroll in a course for grounded responses.</span>
          </div>
          <Link
            href="/student/courses"
            className="font-semibold text-primary hover:underline ml-3 shrink-0"
          >
            Browse Courses →
          </Link>
        </div>
      )}

      {/* Error alert banner */}
      {errorBanner && (
        <div className="bg-error-container text-on-error-container border border-error/30 rounded-2xl p-3.5 text-xs font-body-sm flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{errorBanner}</span>
          </div>
          {messageStatus === "failed" && pendingMessageKey && (
            <button
              type="button"
              onClick={handleRetry}
              className="font-semibold underline ml-2 shrink-0"
            >
              Retry
            </button>
          )}
          <button
            type="button"
            onClick={() => setErrorBanner(null)}
            className="font-bold text-on-error-container hover:opacity-80 ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Two-Column Responsive Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Main Conversational Workspace (lg:col-span-8) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Dialogue History Thread */}
          <div className="space-y-6">
            {messages.map((msg) => (
              <div key={msg.id}>
                {msg.sender === "user" ? (
                  /* User Prompt Bubble */
                  <div className="flex justify-end gap-3 pl-8">
                    <div className="max-w-[85%] bg-linear-to-br from-[#1e1b4b] via-[#2e1065] to-[#1e1b4b] text-on-primary rounded-2xl p-5 shadow-md border border-primary-fixed/20 space-y-2">
                      <div className="flex items-center justify-between gap-4 pb-1.5 border-b border-white/10">
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[14px] text-secondary-fixed">
                            school
                          </span>
                          <span className="font-label-sm text-[11px] uppercase tracking-wider text-primary-fixed font-semibold">
                            Student Inquiry
                          </span>
                        </div>
                        {currentCourse && (
                          <span className="font-label-sm text-[10px] px-2 py-0.5 rounded-full bg-white/15 text-white">
                            {currentCourse.code}
                          </span>
                        )}
                      </div>
                      <p className="font-body-md text-body-md leading-relaxed text-slate-100 whitespace-pre-wrap">
                        {msg.content}
                      </p>
                      {msg.deliveryStatus && (
                        <div className="border-t border-white/20 pt-1.5 text-[10px] font-semibold text-primary-fixed">
                          {deliveryStatusLabel(msg.deliveryStatus)}
                        </div>
                      )}
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-linear-to-br from-primary to-primary-container text-on-primary flex items-center justify-center font-label-md text-xs font-bold shrink-0 mt-1 shadow-sm">
                      ME
                    </div>
                  </div>
                ) : (
                  /* Assistant Grounded Response Card */
                  <div className="flex items-start gap-3 pr-2 sm:pr-4">
                    <div className="w-9 h-9 rounded-xl bg-linear-to-br from-primary to-primary-container flex items-center justify-center text-on-primary shadow-xs shrink-0 mt-1">
                      <span className="material-symbols-outlined text-[20px]">psychology</span>
                    </div>

                    <div className="flex-1 bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-sm border border-surface-container-high space-y-4">
                      {/* Header Metadata */}
                      <div className="flex items-center justify-between pb-3 bg-surface-container-low -mx-5 sm:-mx-6 -mt-5 sm:-mt-6 p-4 rounded-t-2xl border-b border-surface-container-high">
                        <div className="flex items-center gap-2">
                          <span className="font-headline-sm text-sm font-bold text-on-surface">
                            AURA Coprocessor
                          </span>
                          {msg.sources && msg.sources.length > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-secondary/15 text-secondary font-label-sm text-[11px] font-semibold border border-secondary/20">
                              RAG Grounded ({msg.sources.length} Ref{msg.sources.length > 1 ? "s" : ""})
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopyContent(msg.id, msg.content)}
                            className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
                            title="Copy response text"
                            aria-label="Copy response text"
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              {copiedId === msg.id ? "check" : "content_copy"}
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Grounded Response Body */}
                      <div className="font-body-md text-body-md text-on-surface leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </div>

                      {/* Follow-up Prompts */}
                      {msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && (
                        <div className="pt-3 border-t border-surface-container-high space-y-2">
                          <span className="font-label-sm text-[11px] uppercase tracking-wider text-outline block">
                            Suggested Curricular Continuations
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {msg.suggestedFollowUps.map((q, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => handleSend(q)}
                                className="px-3 py-1.5 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface font-body-sm text-xs transition-colors shadow-2xs flex items-center gap-1.5 border border-surface-container-high cursor-pointer text-left"
                              >
                                <span className="material-symbols-outlined text-[14px] text-primary">
                                  arrow_forward
                                </span>
                                <span>{q}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Loading Indicator Bubble */}
            {loading && (
              <div className="flex items-start gap-3 animate-fade-in">
                <div className="w-9 h-9 rounded-xl bg-linear-to-br from-primary to-primary-container flex items-center justify-center text-on-primary shadow-xs shrink-0 mt-1">
                  <span className="material-symbols-outlined text-[20px]">psychology</span>
                </div>
                <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-5 shadow-sm space-y-2">
                  <div className="flex items-center gap-2 text-primary font-label-sm text-xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-secondary animate-ping" />
                    <span>{deliveryStatusLabel(messageStatus)}</span>
                  </div>
                  <p className="font-body-sm text-xs text-outline">
                    Cross-referencing verified syllabus materials and lecture chunks.
                  </p>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Rich Composer Bar */}
          <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-surface-container-high flex flex-col gap-3">
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-2">
                <span className="font-label-sm text-[11px] px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-semibold">
                  Grounding: Syllabus Rigor
                </span>
                <span className="font-label-sm text-[11px] text-outline">
                  • Verified Citations Enforced
                </span>
              </div>
              <span className="font-label-sm text-[11px] text-outline hidden sm:inline">
                Shift + Enter for new line
              </span>
            </div>

            <div className="relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                rows={3}
                placeholder="Ask a question about syllabus concepts, lecture derivations, or course topics..."
                className="w-full bg-surface-container-low text-on-surface placeholder:text-outline font-body-md text-body-md rounded-xl p-3.5 outline-hidden resize-none focus:bg-surface-container transition-colors border border-surface-container-high"
                aria-label="Ask AI Tutor"
              />
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                <button
                  type="button"
                  disabled={loading || !input.trim()}
                  onClick={() => handleSend()}
                  className="px-4 py-2 rounded-xl bg-primary-container text-on-primary font-body-sm text-xs font-semibold hover:opacity-95 disabled:opacity-50 transition-opacity shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Send Query</span>
                  <span className="material-symbols-outlined text-[16px]">send</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <p className="font-label-sm text-[11px] text-outline flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] text-secondary">lock</span>
                Answers are grounded strictly in your official syllabus and uploaded materials.
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Inspector Sidebar (lg:col-span-4) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* 1. Grounded Sources Inspection Panel */}
          <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-surface-container-high space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[20px]">menu_book</span>
                </div>
                <h3 className="font-headline-sm text-sm font-bold text-on-surface">
                  Source Citations
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-primary-fixed text-primary font-label-sm text-[11px] font-bold border border-primary/20">
                {activeSources.length} Active Reference{activeSources.length !== 1 ? "s" : ""}
              </span>
            </div>

            {activeSources.length > 0 ? (
              <div className="space-y-3">
                {activeSources.map((src, idx) => (
                  <div
                    key={idx}
                    className="bg-surface-container-low/70 border border-surface-container-high rounded-xl p-3.5 space-y-2 shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="px-1.5 py-0.5 rounded bg-error-container text-on-error-container font-label-sm text-[10px] font-bold flex items-center gap-0.5 shrink-0">
                          <span className="material-symbols-outlined text-[11px]">
                            picture_as_pdf
                          </span>
                          DOC
                        </span>
                        <span className="font-label-md text-xs text-on-surface font-semibold truncate">
                          {src.documentName}
                        </span>
                      </div>
                      <span className="font-label-sm text-[10px] text-outline font-medium shrink-0 ml-1">
                        {src.page ? `Page ${src.page}` : src.unit || "Ref"}
                      </span>
                    </div>

                    {src.excerpt && (
                      <div className="bg-surface-container-lowest p-2.5 rounded-lg font-body-sm text-xs text-on-surface leading-snug border border-surface-container-high/60 italic">
                        &ldquo;{src.excerpt}&rdquo;
                      </div>
                    )}

                    <div className="flex items-center justify-between font-label-sm text-[10px] pt-0.5">
                      <span className="px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container font-semibold">
                        {src.score ? `${Math.round(src.score * 100)}% Match` : "Verified RAG"}
                      </span>
                      {src.unit && <span className="text-outline">{src.unit}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-on-surface-variant font-body-sm text-xs space-y-1">
                <span className="material-symbols-outlined text-[24px] text-outline block mb-1">
                  find_in_page
                </span>
                <p>No citations active for this query.</p>
                <p className="font-label-sm text-[10px] text-outline">
                  Ask a question to inspect verified document chunks and citations.
                </p>
              </div>
            )}
          </div>

          {/* 2. Conversation Threads Panel */}
          <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-surface-container-high space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary">
                  <span className="material-symbols-outlined text-[20px]">forum</span>
                </div>
                <h3 className="font-headline-sm text-sm font-bold text-on-surface">
                  Session History
                </h3>
              </div>
              <button
                type="button"
                onClick={handleNewSession}
                className="font-label-sm text-[11px] font-bold text-primary hover:underline"
              >
                + New
              </button>
            </div>

            {loadingConversations ? (
              <div className="py-4 text-center font-label-sm text-xs text-outline">
                Loading history...
              </div>
            ) : conversations.length > 0 ? (
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {conversations.map((convo) => {
                  const isCurrent = conversationId === convo.id;
                  return (
                    <div
                      key={convo.id}
                      onClick={() => handleSelectConversation(convo.id)}
                      className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors text-xs ${
                        isCurrent
                          ? "bg-primary-container text-on-primary font-semibold shadow-2xs"
                          : "hover:bg-surface-container-low text-on-surface"
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="truncate font-medium">{convo.title}</div>
                        <div
                          className={`font-label-sm text-[10px] mt-0.5 ${
                            isCurrent ? "text-on-primary/70" : "text-outline"
                          }`}
                        >
                          {convo.course?.code || "General"} •{" "}
                          {new Date(convo.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteConversation(e, convo.id)}
                        className={`opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-error-container hover:text-on-error-container transition-opacity ${
                          isCurrent ? "text-on-primary hover:text-on-error-container" : "text-outline"
                        }`}
                        title="Delete conversation"
                        aria-label="Delete conversation"
                      >
                        <span className="material-symbols-outlined text-[14px]">delete</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-4 text-center font-body-sm text-xs text-on-surface-variant">
                No saved conversation history yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
