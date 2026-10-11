import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { AiMetadataSuggestion } from "../types";

// Upload assistant: uploads the chosen PDF once, asks the server to read the first pages
// (OCR if scanned) and returns suggested form fields.
export function useAiMetadata() {
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [applied, setApplied] = useState(false);
  const uploaded = useRef<{ file: File; url: string } | null>(null);
  const alive = useRef(true);
  const runId = useRef(0);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  // Upload the file if this exact file was not uploaded yet; returns its /uploads/ URL
  async function ensureUploaded(file: File): Promise<string> {
    if (uploaded.current && uploaded.current.file === file) return uploaded.current.url;
    const res = await api.uploadFile(file);
    uploaded.current = { file, url: res.fileUrl };
    return res.fileUrl;
  }

  async function run(file: File): Promise<AiMetadataSuggestion | null> {
    const id = ++runId.current;
    const stillCurrent = () => alive.current && runId.current === id;
    setRunning(true);
    setError("");
    setApplied(false);
    setMessage("Uploading PDF…");
    try {
      const url = await ensureUploaded(file);
      let job = await api.startMetadataExtraction(url);
      const started = Date.now();
      while (job.status === "running") {
        if (!stillCurrent()) return null;
        setMessage(job.message);
        if (Date.now() - started > 15 * 60 * 1000) throw new Error("This is taking too long. Please fill the form by hand.");
        await new Promise(r => setTimeout(r, 1500));
        job = await api.getMetadataJob(job.id);
      }
      if (!stillCurrent()) return null;
      if (job.status === "failed" || !job.result) throw new Error(job.error || "The AI could not read this PDF");
      setApplied(true);
      setMessage("");
      return job.result;
    } catch (e: any) {
      if (stillCurrent()) setError(e?.message || "AI auto-fill failed");
      return null;
    } finally {
      if (stillCurrent()) setRunning(false);
    }
  }

  function reset() {
    runId.current++;
    uploaded.current = null;
    setRunning(false);
    setMessage("");
    setError("");
    setApplied(false);
  }

  return { running, message, error, applied, run, ensureUploaded, reset };
}

export type AiMetadataHook = ReturnType<typeof useAiMetadata>;
