// Text extraction for uploaded PDFs.
//  - Pages that already contain text (digital PDFs) are read with `pdftotext`.
//  - Scanned pages are rendered with `pdftoppm` and read with `tesseract` (OCR).
// Results are stored per PDF file in TEXT_DIR/<file>.json so they survive restarts
// and can be reused (the upload assistant OCRs the first pages before the paper exists).
//
// Needs: poppler-utils (pdfinfo, pdftotext, pdftoppm) and tesseract-ocr + language data.
// The Docker image installs them; locally: `sudo apt install poppler-utils tesseract-ocr tesseract-ocr-ben`.

import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { config } from "./server-config";
import { dbConnection } from "./server-db";
import { resolveUploadPath, ensureLocalCopy } from "./server-files";

export { resolveUploadPath };

export interface FileText {
  file: string;                       // upload file name
  pageCount: number;
  pages: (string | null)[];           // index 0 = page 1; null = not processed yet
  method: ("text" | "ocr" | "empty" | "error")[];
  complete: boolean;
  forcedOcr?: boolean;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

function textPathFor(fileUrl: string): string | null {
  const pdf = resolveUploadPath(fileUrl);
  if (!pdf) return null;
  return path.join(config.TEXT_DIR, path.basename(pdf) + ".json");
}

export function loadFileText(fileUrl: string | undefined): FileText | null {
  const p = fileUrl ? textPathFor(fileUrl) : null;
  if (!p || !fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function saveFileText(fileUrl: string, ft: FileText) {
  const p = textPathFor(fileUrl);
  if (!p) return;
  ft.updatedAt = new Date().toISOString();
  const tmp = p + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(ft));
  fs.renameSync(tmp, p);
}

export function deleteFileText(fileUrl: string | undefined) {
  const p = fileUrl ? textPathFor(fileUrl) : null;
  if (p && fs.existsSync(p)) {
    try { fs.unlinkSync(p); } catch { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------
// External tools
// ---------------------------------------------------------------------------

interface RunResult { code: number; stdout: Buffer; stderr: string; }

let useNice = false;

function run(cmd: string, args: string[], timeoutMs: number, extraEnv: Record<string, string> = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    // Run at low priority so the website stays responsive while OCR is busy
    const [bin, binArgs] = useNice ? ["nice", ["-n", "10", cmd, ...args]] : [cmd, args];
    const child = spawn(bin, binArgs, { env: { ...process.env, ...extraEnv }, stdio: ["ignore", "pipe", "pipe"] });
    const out: Buffer[] = [];
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${cmd} timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
    child.stdout.on("data", d => out.push(d));
    child.stderr.on("data", d => { if (err.length < 4000) err += d.toString(); });
    child.on("error", e => { clearTimeout(timer); reject(e); });
    child.on("close", code => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, stdout: Buffer.concat(out), stderr: err });
    });
  });
}

async function hasCommand(cmd: string, args: string[] = ["-v"]): Promise<boolean> {
  try {
    await run(cmd, args, 15000);
    return true;
  } catch {
    return false;
  }
}

export const ocrTools = {
  checked: false,
  poppler: false,     // pdfinfo + pdftotext + pdftoppm
  tesseract: false,
  langs: [] as string[],  // usable OCR languages (requested ∩ installed)
};

export async function checkOcrTools() {
  useNice = await hasCommand("nice", ["true"]);
  ocrTools.poppler = (await hasCommand("pdfinfo")) && (await hasCommand("pdftotext")) && (await hasCommand("pdftoppm"));
  ocrTools.tesseract = await hasCommand("tesseract", ["--version"]);
  ocrTools.langs = [];
  if (ocrTools.tesseract) {
    try {
      const r = await run("tesseract", ["--list-langs"], 15000);
      const installed = (r.stdout.toString() + "\n" + r.stderr).split(/\s+/).filter(Boolean);
      const wanted = config.OCR.LANGS.split("+").map(s => s.trim()).filter(Boolean);
      ocrTools.langs = wanted.filter(l => installed.includes(l));
      const missing = wanted.filter(l => !installed.includes(l));
      if (missing.length) console.warn(`[OCR] Tesseract language data missing: ${missing.join(", ")} (install tesseract-ocr-data-<lang>)`);
    } catch { /* ignore */ }
  }
  ocrTools.checked = true;
  console.log(`[OCR] poppler=${ocrTools.poppler} tesseract=${ocrTools.tesseract} languages=${ocrTools.langs.join("+") || "none"}`);
}

// Reading text inside PDFs at all (text layer; OCR additionally needs ocrAvailable)
export function pdfTextAvailable(): boolean {
  return config.OCR.TEXT_ENABLED && ocrTools.poppler;
}

export function ocrAvailable(): boolean {
  return pdfTextAvailable() && config.OCR.ENABLED && ocrTools.tesseract && ocrTools.langs.length > 0;
}

async function getPageCount(pdfPath: string): Promise<number> {
  const r = await run("pdfinfo", [pdfPath], 30000);
  const m = r.stdout.toString().match(/^Pages:\s+(\d+)/m);
  if (!m) throw new Error("Not a readable PDF");
  return parseInt(m[1], 10);
}

// Clean up text from pdftotext / tesseract
function cleanText(s: string): string {
  return s
    .normalize("NFC")
    .replace(/\f/g, "\n")
    .replace(/-\n(?=\p{Ll})/gu, "")          // join hyphenated line breaks (English)
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Does this look like a real text layer (not empty, not garbage)?
function looksLikeText(s: string): boolean {
  const letters = (s.match(/\p{L}/gu) || []).length;
  if (letters < 40) return false;
  const visible = s.replace(/\s/g, "").length || 1;
  const wordish = (s.match(/[\p{L}\p{M}\p{N}]/gu) || []).length;
  return wordish / visible > 0.7;
}

async function textLayerOfPage(pdfPath: string, page: number): Promise<string> {
  const r = await run("pdftotext", ["-f", String(page), "-l", String(page), "-enc", "UTF-8", pdfPath, "-"], 60000);
  return r.code === 0 ? cleanText(r.stdout.toString("utf8")) : "";
}

async function ocrPage(pdfPath: string, page: number): Promise<string> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ocr-"));
  try {
    const base = path.join(tmp, "p");
    const r1 = await run("pdftoppm", [
      "-f", String(page), "-l", String(page), "-singlefile",
      "-r", String(config.OCR.DPI), "-gray", "-png", pdfPath, base
    ], config.OCR.PAGE_TIMEOUT_MS);
    if (r1.code !== 0 || !fs.existsSync(base + ".png")) {
      throw new Error("Could not render page: " + r1.stderr.slice(0, 200));
    }
    const r2 = await run("tesseract", [base + ".png", "stdout", "-l", ocrTools.langs.join("+"), "--psm", "3"],
      config.OCR.PAGE_TIMEOUT_MS, { OMP_THREAD_LIMIT: String(config.OCR.THREADS) });
    if (r2.code !== 0) throw new Error("Tesseract failed: " + r2.stderr.slice(0, 200));
    return cleanText(r2.stdout.toString("utf8"));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// Extract one page: text layer first, OCR if the page is a scan (or if forced)
async function extractPage(pdfPath: string, page: number, forceOcr: boolean): Promise<{ text: string; method: FileText["method"][number] }> {
  let layer = "";
  if (!forceOcr) {
    layer = await textLayerOfPage(pdfPath, page);
    if (looksLikeText(layer)) return { text: layer, method: "text" };
  }
  if (!ocrAvailable()) {
    // No OCR installed: keep whatever little text the page has
    return { text: layer, method: layer ? "text" : "empty" };
  }
  const t = await ocrPage(pdfPath, page);
  return { text: t, method: t ? "ocr" : "empty" };
}

// ---------------------------------------------------------------------------
// Partial extraction (upload assistant): first N pages of an uploaded file
// ---------------------------------------------------------------------------

export async function extractFirstPages(
  fileUrl: string,
  maxPages: number,
  onProgress?: (done: number, total: number) => void
): Promise<{ text: string; pageCount: number }> {
  if (!pdfTextAvailable()) throw new Error("Reading PDFs is not available on this server");
  const pdfPath = await ensureLocalCopy(fileUrl);
  if (!pdfPath) throw new Error("Uploaded PDF not found");

  let ft = loadFileText(fileUrl);
  if (!ft) {
    const pageCount = await getPageCount(pdfPath);
    ft = { file: path.basename(pdfPath), pageCount, pages: new Array(pageCount).fill(null), method: new Array(pageCount).fill("empty"), complete: false, updatedAt: "" };
  }
  const total = Math.min(maxPages, ft.pageCount);
  for (let i = 0; i < total; i++) {
    onProgress?.(i, total);
    if (ft.pages[i] === null) {
      try {
        const r = await extractPage(pdfPath, i + 1, false);
        ft.pages[i] = r.text;
        ft.method[i] = r.method;
      } catch (e: any) {
        console.warn(`[OCR] page ${i + 1} of ${ft.file} failed:`, e?.message || e);
        ft.pages[i] = "";
        ft.method[i] = "error";
      }
      saveFileText(fileUrl, ft);
    }
  }
  onProgress?.(total, total);
  const text = ft.pages.slice(0, total).map((t, i) => `--- Page ${i + 1} ---\n${t || ""}`).join("\n\n");
  return { text, pageCount: ft.pageCount };
}

// ---------------------------------------------------------------------------
// Background queue: full extraction for papers, one paper at a time
// ---------------------------------------------------------------------------

type DoneHook = (paperId: string) => void;

class OcrQueue {
  private queue: { paperId: string; force: boolean }[] = [];
  private running = false;
  private current: string | null = null;
  onPaperDone: DoneHook = () => {};
  onPaperProgress: DoneHook = () => {};

  status() {
    return { running: this.current, queued: this.queue.map(q => q.paperId) };
  }

  enqueue(paperId: string, force = false) {
    if (!pdfTextAvailable()) return;
    if (this.current === paperId && !force) return;
    this.queue = this.queue.filter(q => q.paperId !== paperId);
    this.queue.push({ paperId, force });
    const paper = dbConnection.getPapers().find(p => p.id === paperId);
    if (paper && paper.textStatus !== "processing") {
      paper.textStatus = "pending";
      paper.textError = undefined;
    }
    this.kick();
  }

  cancel(paperId: string) {
    this.queue = this.queue.filter(q => q.paperId !== paperId);
  }

  // After a restart: continue papers that were not finished
  resume() {
    for (const p of dbConnection.getPapers()) {
      if (!pdfTextAvailable() || !resolveUploadPath(p.fileUrl)) {
        if (!pdfTextAvailable() || !p.textStatus) p.textStatus = "unavailable";
        continue;
      }
      if (!p.textStatus || p.textStatus === "pending" || p.textStatus === "processing") {
        this.queue.push({ paperId: p.id, force: false });
        p.textStatus = "pending";
      }
    }
    if (this.queue.length) console.log(`[OCR] ${this.queue.length} paper(s) waiting for text extraction`);
    this.kick();
  }

  private kick() {
    if (this.running) return;
    this.running = true;
    setImmediate(() => this.loop().finally(() => { this.running = false; }));
  }

  private async loop() {
    while (this.queue.length) {
      const job = this.queue.shift()!;
      this.current = job.paperId;
      try {
        await this.process(job.paperId, job.force);
      } catch (e: any) {
        console.error(`[OCR] paper ${job.paperId} failed:`, e?.message || e);
        const paper = dbConnection.getPapers().find(p => p.id === job.paperId);
        if (paper) {
          paper.textStatus = "failed";
          paper.textError = String(e?.message || e).slice(0, 300);
          dbConnection.save();
        }
      } finally {
        this.current = null;
      }
    }
  }

  private async process(paperId: string, force: boolean) {
    const findPaper = () => dbConnection.getPapers().find(p => p.id === paperId);
    let paper = findPaper();
    if (!paper) return;
    const pdfPath = pdfTextAvailable() ? await ensureLocalCopy(paper.fileUrl) : null;
    if (!pdfPath) {
      paper.textStatus = "unavailable";
      dbConnection.save();
      return;
    }

    const fileUrl = paper.fileUrl;
    let ft = loadFileText(fileUrl);
    if (!ft || force) {
      const pageCount = await getPageCount(pdfPath);
      ft = { file: path.basename(pdfPath), pageCount, pages: new Array(pageCount).fill(null), method: new Array(pageCount).fill("empty"), complete: false, forcedOcr: force, updatedAt: "" };
    }
    if (ft.complete && !force) {
      paper.textStatus = "done";
      paper.textPagesDone = paper.textPagesTotal = ft.pageCount;
      dbConnection.save();
      this.onPaperDone(paperId);
      return;
    }

    const total = Math.min(ft.pageCount, config.OCR.MAX_PAGES);
    paper.textStatus = "processing";
    paper.textPagesTotal = total;
    paper.textPagesDone = ft.pages.slice(0, total).filter(p => p !== null).length;
    dbConnection.save();
    const started = Date.now();

    for (let i = 0; i < total; i++) {
      if (ft.pages[i] !== null) continue;
      paper = findPaper();
      if (!paper || paper.fileUrl !== fileUrl) return; // deleted or file replaced meanwhile
      try {
        const r = await extractPage(pdfPath, i + 1, force);
        ft.pages[i] = r.text;
        ft.method[i] = r.method;
      } catch (e: any) {
        console.warn(`[OCR] page ${i + 1}/${total} of paper ${paperId} failed:`, e?.message || e);
        ft.pages[i] = "";
        ft.method[i] = "error";
      }
      saveFileText(fileUrl, ft);
      paper.textPagesDone = i + 1;
      dbConnection.save();
      this.onPaperProgress(paperId);
    }

    paper = findPaper();
    if (!paper) return;
    ft.complete = true;
    saveFileText(fileUrl, ft);

    const errors = ft.method.slice(0, total).filter(m => m === "error").length;
    const ocrPages = ft.method.slice(0, total).filter(m => m === "ocr").length;
    if (errors > total / 2) {
      paper.textStatus = "failed";
      paper.textError = `${errors} of ${total} pages could not be read`;
    } else {
      paper.textStatus = "done";
      paper.textError = !ocrAvailable() && ft.method.includes("empty")
        ? "Some pages are scanned images but OCR is not installed"
        : undefined;
    }
    paper.textPagesDone = total;
    dbConnection.save();
    console.log(`[OCR] "${paper.title.slice(0, 60)}": ${total} pages (${ocrPages} OCR) in ${Math.round((Date.now() - started) / 1000)}s`);
    this.onPaperDone(paperId);
  }
}

export const ocrQueue = new OcrQueue();
