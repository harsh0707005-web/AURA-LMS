"use client";

import React, { useRef, useState } from "react";
import Topbar from "@/components/layout/Topbar";
import { apiRequest } from "@/lib/api";

interface ImportResponse {
  imported: number;
  mode: "UPSERT";
}

function isRegistryPayload(value: unknown): value is { records: unknown[] } {
  return typeof value === "object" && value !== null && "records" in value && Array.isArray(value.records);
}

export default function StudentRegistryPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [jsonInput, setJsonInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setErrorMessage("");
    setSuccessMessage("");
    try {
      setJsonInput(await file.text());
    } catch {
      setErrorMessage("Unable to read that file.");
    }
  };

  const importRegistry = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    let payload: unknown;
    try {
      payload = JSON.parse(jsonInput);
    } catch {
      setErrorMessage("Enter valid JSON before importing the student registry.");
      return;
    }

    if (!isRegistryPayload(payload) || payload.records.length === 0) {
      setErrorMessage('The import must be a JSON object with a non-empty "records" array.');
      return;
    }

    setLoading(true);
    try {
      const response = await apiRequest<ImportResponse>("/admin/student-registry/import", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setSuccessMessage(`${response.data?.imported ?? payload.records.length} registry record${(response.data?.imported ?? payload.records.length) === 1 ? "" : "s"} imported.`);
      setJsonInput("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to import the student registry.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-surface min-h-screen text-on-surface">
      <Topbar title="Student Registry Import" subtitle="Maintain the institution-approved enrollment records" />
      <main className="flex-1 p-6 sm:p-8 max-w-4xl mx-auto w-full">
        <section className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-6 sm:p-8 shadow-xs">
          <div className="flex items-start gap-3 pb-5 border-b border-outline-variant/30">
            <div className="w-10 h-10 rounded-xl bg-primary-container text-on-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined">upload_file</span>
            </div>
            <div>
              <h1 className="text-lg font-bold">Import approved student identities</h1>
              <p className="mt-1 text-xs text-on-surface-variant leading-relaxed">
                Upload a JSON file or paste a JSON object containing 1–1,000 records. Each record must include an enrollment number and institutional email; the backend validates and upserts the registry without resetting claimed identities.
              </p>
            </div>
          </div>

          {errorMessage && (
            <div className="mt-5 rounded-xl bg-error-container text-on-error-container px-4 py-3 text-xs font-medium flex items-center gap-2" role="alert">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{errorMessage}</span>
            </div>
          )}
          {successMessage && (
            <div className="mt-5 rounded-xl bg-secondary-container/50 text-on-surface px-4 py-3 text-xs font-medium flex items-center gap-2" role="status">
              <span className="material-symbols-outlined text-secondary text-[18px]">check_circle</span>
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={importRegistry} className="mt-6 space-y-5">
            <div>
              <label htmlFor="registry-file" className="block text-[11px] font-mono uppercase tracking-wider font-semibold text-on-surface mb-1.5">
                JSON file
              </label>
              <input
                ref={fileInputRef}
                id="registry-file"
                type="file"
                accept="application/json,.json"
                onChange={loadFile}
                className="block w-full text-xs text-on-surface-variant file:mr-3 file:rounded-lg file:border-0 file:bg-surface-container-high file:px-3 file:py-2 file:text-xs file:font-semibold file:text-on-surface hover:file:bg-surface-container"
              />
            </div>

            <div>
              <label htmlFor="registry-json" className="block text-[11px] font-mono uppercase tracking-wider font-semibold text-on-surface mb-1.5">
                Registry JSON
              </label>
              <textarea
                id="registry-json"
                value={jsonInput}
                onChange={(event) => {
                  setJsonInput(event.target.value);
                  setErrorMessage("");
                  setSuccessMessage("");
                }}
                required
                rows={12}
                spellCheck={false}
                placeholder={'{ "records": [ ... ] }'}
                className="w-full resize-y bg-surface-container-low border border-outline-variant/50 rounded-lg px-3 py-2.5 text-xs text-on-surface font-mono focus:outline-none focus:border-primary transition-colors"
              />
              <p className="mt-1.5 text-[11px] text-on-surface-variant">Only the import result is displayed after submission; registry contents are not listed in the application.</p>
            </div>

            <button
              type="submit"
              disabled={loading || !jsonInput.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-on-primary hover:bg-primary-container disabled:opacity-50 transition-colors"
            >
              {loading && <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {loading ? "Importing…" : "Import registry"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
