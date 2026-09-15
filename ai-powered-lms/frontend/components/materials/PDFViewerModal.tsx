"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Material, MaterialProgress } from "@/lib/types";
import { getAuthToken } from "@/lib/auth";
import { apiRequest } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

interface PDFViewerModalProps {
  material: Material;
  onClose: () => void;
  onProgressUpdate?: (updated: MaterialProgress) => void;
}

export default function PDFViewerModal({
  material,
  onClose,
  onProgressUpdate,
}: PDFViewerModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(material.progress?.currentPage || 1);
  const [totalPages, setTotalPages] = useState<number>(material.progress?.totalPages || 1);
  const [progressPercent, setProgressPercent] = useState<number>(
    material.progress?.progressPercent || 0
  );
  const [completed, setCompleted] = useState<boolean>(material.progress?.completed || false);
  const [resumePrompt, setResumePrompt] = useState<string | null>(
    material.progress && material.progress.currentPage > 1
      ? `Resuming from saved Page ${material.progress.currentPage}`
      : null
  );
  const [zoom, setZoom] = useState<number>(1.2);
  const [rendering, setRendering] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Fetch initial progress and load PDF document
  useEffect(() => {
    let isMounted = true;

    async function loadPdfAndProgress() {
      try {
        setLoading(true);
        setError(null);

        const token = getAuthToken();
        if (!token) {
          throw new Error("Authentication session missing. Please log in.");
        }

        // Fetch latest saved progress
        const progRes = await apiRequest<MaterialProgress>(`/materials/${material.id}/progress`);
        if (progRes.success && progRes.data) {
          const initPage = progRes.data.currentPage || 1;
          const initTotal = progRes.data.totalPages || 1;
          setCurrentPage(initPage);
          setTotalPages(initTotal);
          setProgressPercent(progRes.data.progressPercent || 0);
          setCompleted(progRes.data.completed || false);

          if (initPage > 1) {
            setResumePrompt(`Continuing from saved Page ${initPage}`);
          }
        }

        // Fetch PDF binary stream
        const fileRes = await fetch(`${API_BASE}/materials/${material.id}/file`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!fileRes.ok) {
          const errData = await fileRes.json().catch(() => ({}));
          throw new Error(
            errData.message || `Failed to load course PDF (HTTP ${fileRes.status})`
          );
        }

        const blob = await fileRes.blob();
        const blobUrl = URL.createObjectURL(blob);
        if (!isMounted) return;
        setPdfBlobUrl(blobUrl);

        const arrayBuffer = await blob.arrayBuffer();

        // Load PDF.js dynamically
        const pdfjsLib = await loadPdfJs();
        const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        if (!isMounted) return;
        setPdfDoc(doc);
        const count = doc.numPages || 1;
        setTotalPages(count);

        // Ensure page index is valid
        const initialPage = material.progress?.currentPage
          ? Math.min(material.progress.currentPage, count)
          : 1;
        setCurrentPage(initialPage);
      } catch (err: any) {
        if (!isMounted) return;
        console.error("PDF Loading Error:", err);
        setError(err.message || "Failed to render PDF document.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadPdfAndProgress();

    return () => {
      isMounted = false;
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    };
  }, [material.id]);

  // 2. Render Page on Canvas
  useEffect(() => {
    let cancelRender = false;

    async function renderPage() {
      if (!pdfDoc || !canvasRef.current) return;

      try {
        setRendering(true);
        const page = await pdfDoc.getPage(currentPage);
        if (cancelRender) return;

        const viewport = page.getViewport({ scale: zoom * 1.5 });
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
      } catch (err) {
        console.error("Render Page Error:", err);
      } finally {
        setRendering(false);
      }
    }

    renderPage();

    return () => {
      cancelRender = true;
    };
  }, [pdfDoc, currentPage, zoom]);

  // 3. Debounced Progress Persistence
  const saveProgress = useCallback(
    async (page: number, total: number) => {
      try {
        const percent = Math.min(100, Math.max(0, Math.round((page / total) * 100)));
        const isDone = page >= total || percent >= 100;

        setProgressPercent(percent);
        if (isDone) setCompleted(true);

        const res = await apiRequest<MaterialProgress>(`/materials/${material.id}/progress`, {
          method: "PUT",
          body: JSON.stringify({
            currentPage: page,
            totalPages: total,
            completed: isDone,
          }),
        });

        if (res.success && res.data && onProgressUpdate) {
          onProgressUpdate(res.data);
        }
      } catch (err) {
        console.error("Progress save failed:", err);
      }
    },
    [material.id, onProgressUpdate]
  );

  const handlePageChange = (newPage: number) => {
    const validPage = Math.max(1, Math.min(totalPages, newPage));
    setCurrentPage(validPage);
    setResumePrompt(null);

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveProgress(validPage, totalPages);
    }, 400);
  };

  const handleClose = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveProgress(currentPage, totalPages);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl h-[92vh] rounded-xl flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header Toolbar */}
        <div className="px-4 py-3 bg-slate-800 border-b border-slate-700 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-3 overflow-hidden">
            <span className="text-xl">📄</span>
            <div className="truncate">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-white text-sm truncate">{material.title}</span>
                {material.course && (
                  <span className="px-2 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-700 text-[10px] font-mono uppercase shrink-0">
                    {material.course.code}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 font-medium truncate">
                {material.unit} • Grounded Course Reference Document
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            {/* Progress Badge */}
            <div className="hidden sm:flex items-center space-x-2 bg-slate-900/80 px-3 py-1 rounded-md border border-slate-700 text-xs">
              <div className="w-20 bg-slate-700 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    completed ? "bg-emerald-500" : "bg-blue-500"
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="font-mono text-slate-300 text-[11px] font-bold">
                {progressPercent}%
              </span>
              {completed ? (
                <span className="text-[10px] text-emerald-400 font-semibold uppercase bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800">
                  Completed
                </span>
              ) : (
                <span className="text-[10px] text-blue-400 font-semibold uppercase bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-800">
                  Reading
                </span>
              )}
            </div>

            {/* Close Button */}
            <button
              onClick={handleClose}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white rounded-md text-xs font-semibold transition-colors flex items-center space-x-1 cursor-pointer"
            >
              <span>✕ Close Viewer</span>
            </button>
          </div>
        </div>

        {/* Resume Alert Banner */}
        {resumePrompt && (
          <div className="bg-blue-950/80 border-b border-blue-800 px-4 py-2 text-xs text-blue-200 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2">
              <span className="text-blue-400">⏱️</span>
              <span>
                <strong>Welcome back:</strong> {resumePrompt}. Your reading progress is synchronized.
              </span>
            </div>
            <button
              onClick={() => setResumePrompt(null)}
              className="text-blue-400 hover:text-blue-200 text-xs font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Main Document Viewport */}
        <div className="flex-1 bg-slate-950 overflow-auto p-4 flex items-center justify-center relative">
          {loading ? (
            <div className="text-center space-y-3">
              <div className="animate-spin text-3xl">⏳</div>
              <div className="text-xs text-slate-400 font-medium">
                Fetching and rendering verified course document...
              </div>
            </div>
          ) : error ? (
            <div className="text-center max-w-md p-6 bg-slate-900 border border-rose-800/80 rounded-lg space-y-3">
              <span className="text-2xl">⚠️</span>
              <div className="text-sm font-bold text-rose-400">Unable to Stream Document</div>
              <p className="text-xs text-slate-400">{error}</p>
              <button
                onClick={handleClose}
                className="mt-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-semibold"
              >
                Return to Course
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center shadow-2xl relative">
              {rendering && (
                <div className="absolute top-2 right-2 bg-slate-900/80 backdrop-blur-xs px-2 py-1 rounded text-[10px] text-slate-400 border border-slate-700">
                  Rendering...
                </div>
              )}
              <canvas
                ref={canvasRef}
                className="max-w-full rounded-sm bg-white shadow-xl"
                style={{
                  maxHeight: "74vh",
                  objectFit: "contain",
                }}
              />
            </div>
          )}
        </div>

        {/* Bottom Pagination & Zoom Controls */}
        <div className="px-4 py-2.5 bg-slate-800 border-t border-slate-700 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
          {/* Navigation Controls */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1 || loading}
              className="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
            >
              ← Previous
            </button>

            <div className="flex items-center space-x-1 font-mono text-slate-300">
              <span>Page</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={currentPage}
                onChange={(e) => handlePageChange(parseInt(e.target.value) || 1)}
                className="w-12 text-center bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
              />
              <span>of {totalPages}</span>
            </div>

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || loading}
              className="px-3 py-1.5 rounded bg-blue-700 hover:bg-blue-600 disabled:opacity-40 disabled:hover:bg-blue-700 text-white font-semibold text-xs transition-colors cursor-pointer"
            >
              Next →
            </button>
          </div>

          {/* Zoom & Quick Jump */}
          <div className="flex items-center space-x-3 text-slate-400">
            <div className="flex items-center space-x-1 bg-slate-900 border border-slate-700 rounded p-0.5">
              <button
                onClick={() => setZoom((z) => Math.max(0.8, z - 0.2))}
                className="px-2 py-0.5 hover:text-white text-xs font-bold"
                title="Zoom Out"
              >
                −
              </button>
              <span className="text-[11px] font-mono text-slate-300 px-1">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom((z) => Math.min(2.0, z + 0.2))}
                className="px-2 py-0.5 hover:text-white text-xs font-bold"
                title="Zoom In"
              >
                +
              </button>
            </div>

            <button
              onClick={() => handlePageChange(totalPages)}
              className="hidden sm:inline text-[11px] text-slate-400 hover:text-slate-200 underline"
            >
              Jump to End
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Loads the PDF.js standalone library dynamically via CDN.
 */
let pdfjsPromise: Promise<any> | null = null;

function loadPdfJs(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject("Window is undefined");
  if ((window as any).pdfjsLib) return Promise.resolve((window as any).pdfjsLib);

  if (!pdfjsPromise) {
    pdfjsPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.async = true;
      script.onload = () => {
        const lib = (window as any).pdfjsLib;
        if (lib) {
          lib.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
          resolve(lib);
        } else {
          reject(new Error("pdfjsLib not found on window"));
        }
      };
      script.onerror = () => reject(new Error("Failed to load PDF.js bundle"));
      document.head.appendChild(script);
    });
  }

  return pdfjsPromise;
}
