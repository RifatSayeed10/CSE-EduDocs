import path from "path";
import fs from "fs";
import crypto from "crypto";
import dotenv from "dotenv";

// Load environment variables from .env file if present
dotenv.config();

// The bundled server (dist-server/server.cjs) runs in production mode unless told otherwise,
// so `npm start` works the same on Windows, macOS and Linux.
const NODE_ENV = process.env.NODE_ENV || (/server\.cjs$/.test(process.argv[1] || "") ? "production" : "development");
const isProduction = NODE_ENV === "production";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Centralized persistent directory configuration
const defaultDataDir = path.join(process.cwd(), "data");
let DATA_DIR = process.env.DATA_DIR || defaultDataDir;
let UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(DATA_DIR, "uploads");
let DB_BACKUP_FILE = process.env.DB_BACKUP_FILE || path.join(DATA_DIR, "archive-database.json");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/research_archive";
const REQUIRE_MONGODB = process.env.REQUIRE_MONGODB === "true";

// JWT Secret validation & initialization
const rawJwtSecret = process.env.JWT_SECRET;
let JWT_SECRET = rawJwtSecret;

if (!JWT_SECRET || JWT_SECRET.trim() === "" || JWT_SECRET.includes("CHANGE_ME")) {
  if (isProduction) {
    JWT_SECRET = crypto.randomBytes(32).toString("hex");
    console.warn("[Security] JWT_SECRET is not set. Using a random secret: everyone will be logged out whenever the container restarts. Set JWT_SECRET in .env.");
  } else {
    JWT_SECRET = "dev_research_archive_secret_key_local_only_2026";
  }
}

const rawAdminPassword = process.env.ADMIN_DEFAULT_PASSWORD;
const ADMIN_DEFAULT_PASSWORD =
  rawAdminPassword && !rawAdminPassword.includes("CHANGE_ME")
    ? rawAdminPassword
    : (isProduction ? undefined : "adminpassword2026");

// Email of the admin account created on first start
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@cse.pust.ac.bd").trim().toLowerCase();

// Accounts with these emails are always admins (comma separated)
const ADMIN_EMAILS = [ADMIN_EMAIL, ...(process.env.ADMIN_EMAILS || "").split(",")]
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

// Fill a brand-new database with sample papers/projects/faculty (good for testing, not for the real site)
const SEED_DEMO_DATA = process.env.SEED_DEMO_DATA
  ? process.env.SEED_DEMO_DATA === "true"
  : !isProduction;

// Helper to mask sensitive database credentials in log outputs
function getSanitizedMongoUri(uri: string = MONGODB_URI): string {
  try {
    return uri.replace(/\/\/(.*?):(.*?)@/, (_, user) => `//${user}:******@`);
  } catch {
    return "mongodb://[sanitized-credentials]";
  }
}

// Make sure the storage folders exist AND are writable
function checkWritable(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
  const probe = path.join(dir, `.write-test-${process.pid}`);
  fs.writeFileSync(probe, "ok");
  fs.unlinkSync(probe);
}

function ensureStorageDirectories(): void {
  try {
    checkWritable(DATA_DIR);
    checkWritable(UPLOAD_DIR);
    checkWritable(path.dirname(DB_BACKUP_FILE));
  } catch (err: any) {
    if (isProduction) {
      // In Docker this almost always means the NAS folder mounted at /app-data
      // is not writable by the container user. Falling back to a folder inside the
      // container would silently lose every upload on the next restart, so stop here.
      console.error(`[Storage] FATAL: "${DATA_DIR}" is not writable (${err?.code || err}).`);
      console.error(`[Storage] Fix the folder permissions on the NAS (see NAS_DEPLOYMENT.md, step 3) and restart.`);
      process.exit(1);
    }
    console.warn(`[Storage] ${DATA_DIR} is not writable, using ./data instead:`, err?.message || err);
    const fallbackDir = path.join(process.cwd(), "data");
    DATA_DIR = fallbackDir;
    UPLOAD_DIR = path.join(fallbackDir, "uploads");
    DB_BACKUP_FILE = path.join(fallbackDir, "archive-database.json");
    checkWritable(DATA_DIR);
    checkWritable(UPLOAD_DIR);
  }
}

// Run directory verification immediately
ensureStorageDirectories();

// Extracted/OCR text of uploaded PDFs (one JSON file per PDF)
const TEXT_DIR = process.env.TEXT_DIR || path.join(DATA_DIR, "text");
try { checkWritable(TEXT_DIR); } catch (err) { console.warn(`[Storage] TEXT_DIR ${TEXT_DIR} not writable:`, err); }

function intEnv(name: string, def: number, min: number, max: number): number {
  const v = parseInt(process.env[name] || "", 10);
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
}

// ---- Uploaded files ----
// "local" = server disk (UPLOAD_DIR); "mongo" = inside MongoDB (GridFS), for hosts that wipe their disk
const FILE_STORAGE = (process.env.FILE_STORAGE || "local").trim().toLowerCase() === "mongo" ? "mongo" : "local";
const MAX_UPLOAD_MB = intEnv("MAX_UPLOAD_MB", 50, 1, 500);

// ---- OCR / text extraction ----
const OCR = {
  // PDF_TEXT_ENABLED=false turns off reading text inside PDFs completely (search then uses
  // title/authors/keywords/abstract only, and the AI upload auto-fill is hidden)
  TEXT_ENABLED: process.env.PDF_TEXT_ENABLED !== "false",
  ENABLED: process.env.OCR_ENABLED !== "false",
  LANGS: (process.env.OCR_LANGS || "ben+eng").trim(),   // Tesseract languages
  THREADS: intEnv("OCR_THREADS", 2, 1, 16),             // CPU threads per page
  DPI: intEnv("OCR_DPI", 300, 150, 600),
  MAX_PAGES: intEnv("OCR_MAX_PAGES", 400, 1, 5000),
  PAGE_TIMEOUT_MS: intEnv("OCR_PAGE_TIMEOUT_SEC", 300, 30, 3600) * 1000,
};

// ---- AI (any OpenAI-compatible chat API: Groq, Gemini, OpenRouter, Cerebras, Ollama ...) ----
export interface AiProvider { name: string; url: string; key: string; model: string; }
const AI_PROVIDERS: AiProvider[] = [1, 2, 3]
  .map(i => ({
    name: (process.env[`AI_PROVIDER_${i}_NAME`] || `provider${i}`).trim(),
    url: (process.env[`AI_PROVIDER_${i}_URL`] || "").trim().replace(/\/+$/, ""),
    key: (process.env[`AI_PROVIDER_${i}_KEY`] || "").trim(),
    model: (process.env[`AI_PROVIDER_${i}_MODEL`] || "").trim(),
  }))
  .filter(p => p.url && p.model);

const AI = {
  PROVIDERS: AI_PROVIDERS,
  ENABLED: AI_PROVIDERS.length > 0 && process.env.AI_ENABLED !== "false",
  USER_DAILY_LIMIT: intEnv("AI_USER_DAILY_LIMIT", 30, 0, 100000),     // per normal user per day
  ALLOW_GUESTS: process.env.AI_ALLOW_GUESTS !== "false",              // Ask AI without logging in
  GUEST_DAILY_LIMIT: intEnv("AI_GUEST_DAILY_LIMIT", 10, 0, 100000),   // per visitor IP per day
  GLOBAL_DAILY_LIMIT: intEnv("AI_GLOBAL_DAILY_LIMIT", 800, 0, 1000000), // whole site per day
  CONTEXT_CHARS: intEnv("AI_CONTEXT_CHARS", 9000, 2000, 100000),     // source text sent per question
  METADATA_PAGES: intEnv("AI_METADATA_PAGES", 6, 1, 20),             // pages read by the upload assistant
  TIMEOUT_MS: intEnv("AI_TIMEOUT_SEC", 60, 10, 600) * 1000,
};

export const config = {
  PORT,
  NODE_ENV,
  isProduction,
  DATA_DIR,
  UPLOAD_DIR,
  DB_BACKUP_FILE,
  MONGODB_URI,
  REQUIRE_MONGODB,
  JWT_SECRET: JWT_SECRET as string,
  ADMIN_DEFAULT_PASSWORD,
  ADMIN_EMAIL,
  ADMIN_EMAILS,
  SEED_DEMO_DATA,
  TEXT_DIR,
  FILE_STORAGE,
  MAX_UPLOAD_MB,
  OCR,
  AI,
  getSanitizedMongoUri,
  ensureStorageDirectories,
};
