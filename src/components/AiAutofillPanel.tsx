import React from "react";
import { Sparkles, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { AiMetadataHook } from "../lib/useAiMetadata";
import { AiMetadataSuggestion } from "../types";

interface Props {
  ai: AiMetadataHook;
  file: File | null;
  onApply: (s: AiMetadataSuggestion) => void;
}

// "Auto-fill with AI" box shown under the PDF picker in the upload forms
export default function AiAutofillPanel({ ai, file, onApply }: Props) {
  if (!file) return null;

  const start = async () => {
    const result = await ai.run(file);
    if (result) onApply(result);
  };

  return (
    <div className="rounded-xl border border-violet-200 dark:border-violet-900/60 bg-violet-50/60 dark:bg-violet-950/20 p-3 text-xs space-y-2">
      {ai.running ? (
        <div className="flex items-center gap-2 text-violet-800 dark:text-violet-300 font-medium">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          <span>{ai.message || "Working…"} <span className="text-violet-500">Scanned PDFs take a little longer.</span></span>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
          <span className="text-violet-900 dark:text-violet-200">
            Let AI read the first pages and fill in the form for you.
          </span>
          <button
            type="button"
            onClick={start}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 font-semibold shadow-xs cursor-pointer transition shrink-0"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {ai.applied ? "Run again" : "Auto-fill with AI"}
          </button>
        </div>
      )}
      {ai.error && (
        <div className="flex items-start gap-1.5 text-red-700 dark:text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0 mt-px" />
          <span>{ai.error}</span>
        </div>
      )}
      {ai.applied && !ai.running && (
        <div className="flex items-start gap-1.5 text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-px" />
          <span>Fields filled by AI. Please check names, supervisor and abstract before submitting — AI can make mistakes.</span>
        </div>
      )}
    </div>
  );
}
