import express, { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import multer from "multer";
import { config } from "./server-config";
import { dbConnection } from "./server-db";
import { resolveUploadPath, deleteFileText, checkOcrTools, ocrAvailable, pdfTextAvailable, ocrTools, ocrQueue } from "./server-ocr";
import { persistUpload, openUpload, deleteUpload, storageMode, mongoStorageUsedMb } from "./server-files";
import { searchIndex } from "./server-search";
import { AiError, askArchive, consumeQuota, getMetadataJob, refundQuota, remainingFor, startMetadataJob } from "./server-ai";
import { Paper, Project, Topic, Researcher, Ticket, ContactMessage, FAQItem } from "./src/types";

const app = express();
app.disable("x-powered-by");
// Behind the NAS reverse proxy (QNAP / nginx), trust the first proxy for client IPs
app.set("trust proxy", 1);
// Files go through /api/upload (multipart), so JSON bodies can stay small
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  next();
});

const PORT = config.PORT;

// SVG is not allowed: an uploaded SVG can carry JavaScript that runs on this site
const ALLOWED_MIMES = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"];
const ALLOWED_EXTS = [".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp"];

// Configure Multer for secure, collision-resistant multipart/form-data storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueId = crypto.randomUUID();
    const rawExt = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, "");
    const safeExt = ALLOWED_EXTS.includes(rawExt) ? rawExt : "";
    const baseName = path.basename(file.originalname, rawExt).replace(/[^a-zA-Z0-9_\-]/g, "_").substring(0, 50);
    cb(null, `${uniqueId}_${baseName}${safeExt || ""}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: config.MAX_UPLOAD_MB * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    // Both the extension and the browser-reported type must be allowed
    if (ALLOWED_MIMES.includes(file.mimetype) && ALLOWED_EXTS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type. Only PDF documents and standard image files are accepted."));
    }
  }
});

// Serve uploaded images/PDFs (from disk, or from MongoDB when FILE_STORAGE=mongo)
app.get("/uploads/:name", async (req: Request, res: Response) => {
  try {
    const f = await openUpload(`/uploads/${req.params.name}`);
    if (!f) return res.status(404).send("Not found");
    res.setHeader("Content-Type", f.contentType);
    res.setHeader("Content-Length", String(f.size));
    res.setHeader("Cache-Control", "public, max-age=604800");
    f.stream.on("error", () => { if (!res.headersSent) res.status(500).end(); else res.end(); });
    f.stream.pipe(res);
  } catch (e) {
    console.error("[Files] read failed:", e);
    if (!res.headersSent) res.status(500).send("Could not read file");
  }
});

// Health Check Endpoint for Docker / Container Station / Monitoring
app.get("/api/health", async (req: Request, res: Response) => {
  const usedMb = await mongoStorageUsedMb().catch(() => null);
  const isMongoConnected = dbConnection.isMongo && dbConnection.mongoClient !== null;
  const isHealthy = isMongoConnected || !config.REQUIRE_MONGODB;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "ok" : "degraded",
    database: isMongoConnected ? "connected" : (config.REQUIRE_MONGODB ? "disconnected" : "fallback-json"),
    environment: config.NODE_ENV,
    storage: {
      uploads: fs.existsSync(config.UPLOAD_DIR) ? "ready" : "unreachable",
      dataDir: fs.existsSync(config.DATA_DIR) ? "ready" : "unreachable",
      files: storageMode(),
      filesInMongoMb: usedMb
    },
    ocr: {
      available: ocrAvailable(),
      languages: ocrTools.langs,
      queue: ocrQueue.status().queued.length,
      processing: ocrQueue.status().running
    },
    search: searchIndex.stats(),
    ai: { enabled: config.AI.ENABLED, providers: config.AI.PROVIDERS.map(p => p.name) }
  });
});

// Middleware: Authenticate Request via Custom Header token
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name?: string;
    role: "student" | "teacher" | "editor" | "admin" | "user";
  };
}

function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const tokenHeader = req.headers.authorization;
  const token = tokenHeader && tokenHeader.startsWith("Bearer ") ? tokenHeader.slice(7) : "";
  if (!token) {
    return next();
  }

  const decoded = dbConnection.verifyToken(token);
  if (decoded) {
    // Always use the current database record, so deleted users lose access
    // immediately and role changes apply without logging in again
    const userInDb = dbConnection.getUsers().find(u => u.id === decoded.id);
    if (userInDb) {
      req.user = {
        id: userInDb.id,
        email: userInDb.email,
        name: userInDb.name || "",
        role: userInDb.role
      };
    }
  }
  next();
}

function isBlocked(req: AuthenticatedRequest): boolean {
  const user = req.user && dbConnection.getUsers().find(u => u.id === req.user!.id);
  return !!user?.isBlocked;
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Please log in first" });
  }
  if (isBlocked(req)) {
    return res.status(403).json({ error: "Your account has been blocked by an administrator." });
  }
  next();
}

// Admins are Super Admins, Editors have high index access
function requireAdminOrEditor(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || isBlocked(req) || (req.user.role !== "admin" && req.user.role !== "editor")) {
    return res.status(403).json({ error: "Administrator or editor privilege required" });
  }
  next();
}

function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || isBlocked(req) || req.user.role !== "admin") {
    return res.status(403).json({ error: "Super Administrator privilege required" });
  }
  next();
}

function isElevatedUser(req: AuthenticatedRequest): boolean {
  return !!req.user && !isBlocked(req) && (req.user.role === "admin" || req.user.role === "editor");
}

// Which papers may this request see? (hidden papers: admins/editors and the uploader only)
function paperVisibility(req: AuthenticatedRequest): (paperId: string) => boolean {
  if (isElevatedUser(req)) return () => true;
  const byId = new Map(dbConnection.getPapers().map(p => [p.id, p]));
  const me = req.user?.id;
  return (id: string) => {
    const p = byId.get(id);
    return !!p && (p.status === "Active" || (!!me && p.uploaderId === me));
  };
}

function publicUser(u: any) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    bookmarks: u.bookmarks || [],
    isBlocked: !!u.isBlocked,
    createdAt: u.createdAt
  };
}

function deleteUploadedFile(fileUrl: string | undefined) {
  deleteUpload(fileUrl).catch(e => console.warn("Could not delete uploaded file:", e));
}

// Very small in-memory rate limiter (per IP + key) for login / password reset
const attemptLog = new Map<string, number[]>();
function tooManyAttempts(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const list = (attemptLog.get(key) || []).filter(t => now - t < windowMs);
  list.push(now);
  attemptLog.set(key, list);
  if (attemptLog.size > 5000) {
    for (const [k, v] of attemptLog) {
      if (v.every(t => now - t >= windowMs)) attemptLog.delete(k);
    }
  }
  return list.length > max;
}

const REGISTERABLE_ROLES = ["student", "teacher"] as const;
const ALL_ROLES = ["student", "teacher", "user", "editor", "admin"] as const;

// Bind auth helper
app.use(authMiddleware as express.RequestHandler);

// --- API ENDPOINTS ---

// 1. BRANDING GET/PUT
app.get("/api/branding", (req: Request, res: Response) => {
  res.json(dbConnection.getBranding());
});

app.put("/api/admin/branding", requireSuperAdmin as unknown as express.RequestHandler, (req: Request, res: Response) => {
  const newBranding = req.body;
  const current = dbConnection.getBranding();
  
  if (newBranding.siteName) current.siteName = newBranding.siteName;
  if (newBranding.siteTagline) current.siteTagline = newBranding.siteTagline;
  if (newBranding.logoUrl) current.logoUrl = newBranding.logoUrl;
  if (newBranding.footerText) current.footerText = newBranding.footerText;
  if (newBranding.allowRegistration !== undefined) current.allowRegistration = !!newBranding.allowRegistration;
  if (newBranding.emailNotifications !== undefined) current.emailNotifications = !!newBranding.emailNotifications;
  if (newBranding.themeMode) current.themeMode = newBranding.themeMode;

  dbConnection.save();
  res.json(current);
});

// 2. FAQS GET/ADMIN
app.get("/api/faqs", (req: Request, res: Response) => {
  res.json(dbConnection.getFaqs());
});

app.post("/api/admin/faqs", requireAdminOrEditor as unknown as express.RequestHandler, (req: Request, res: Response) => {
  const { question, answer } = req.body;
  if (!question || !answer) {
    return res.status(400).json({ error: "Question and answer are required" });
  }
  
  const faqs = dbConnection.getFaqs();
  const newFaq: FAQItem = {
    id: "faq_" + Math.random().toString(36).substring(2, 9),
    question,
    answer
  };
  faqs.push(newFaq);
  dbConnection.save();
  res.status(201).json(newFaq);
});

app.put("/api/admin/faqs/:id", requireAdminOrEditor as unknown as express.RequestHandler, (req: Request, res: Response) => {
  const { id } = req.params;
  const { question, answer } = req.body;
  const faqs = dbConnection.getFaqs();
  const faq = faqs.find(f => f.id === id);
  if (!faq) return res.status(404).json({ error: "FAQ not found" });

  if (question) faq.question = question;
  if (answer) faq.answer = answer;

  dbConnection.save();
  res.json(faq);
});

app.delete("/api/admin/faqs/:id", requireAdminOrEditor as unknown as express.RequestHandler, (req: Request, res: Response) => {
  const { id } = req.params;
  const faqs = dbConnection.getFaqs();
  const idx = faqs.findIndex(f => f.id === id);
  if (idx === -1) return res.status(404).json({ error: "FAQ not found" });

  faqs.splice(idx, 1);
  dbConnection.save();
  res.json({ success: true });
});

// 3. CONTACT SUPPORT TICKETS
app.post("/api/contact", (req: Request, res: Response) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: "Name, email, and message are required" });
  }

  const list = dbConnection.getContactMessages();
  const newMessage: ContactMessage = {
    id: "msg_" + Math.random().toString(36).substring(2, 9),
    name,
    email,
    message,
    status: "open",
    createdAt: new Date().toISOString()
  };
  list.push(newMessage);
  dbConnection.save();

  res.status(201).json({ success: true, item: newMessage });
});

app.get("/api/admin/contact", requireAdminOrEditor as unknown as express.RequestHandler, (req: Request, res: Response) => {
  res.json(dbConnection.getContactMessages());
});

app.put("/api/admin/contact/:id", requireAdminOrEditor as unknown as express.RequestHandler, (req: Request, res: Response) => {
  const { id } = req.params;
  const { reply, status } = req.body;
  const list = dbConnection.getContactMessages();
  const msg = list.find(m => m.id === id);
  if (!msg) return res.status(404).json({ error: "Message not found" });

  if (reply !== undefined) msg.reply = reply;
  if (status) msg.status = status;

  dbConnection.save();
  res.json(msg);
});

// 4. TICKETS
app.get("/api/tickets", requireAuth as unknown as express.RequestHandler, (req: AuthenticatedRequest, res: Response) => {
  const list = dbConnection.getTickets();
  const userTickets = list.filter(t => t.userId === req.user!.id);
  res.json(userTickets);
});

app.post("/api/tickets", requireAuth as unknown as express.RequestHandler, (req: AuthenticatedRequest, res: Response) => {
  const { subject, message } = req.body;
  if (!subject || !message) {
    return res.status(400).json({ error: "Subject and message are required" });
  }

  // Find user's name
  const users = dbConnection.getUsers();
  const userobj = users.find(u => u.id === req.user!.id);
  const userName = userobj ? userobj.name : "Registered User";

  const tickets = dbConnection.getTickets();
  const newTicket: Ticket = {
    id: "tkt_" + Math.random().toString(36).substring(2, 9),
    userId: req.user!.id,
    userName,
    subject,
    message,
    status: "open",
    createdAt: new Date().toISOString()
  };

  tickets.push(newTicket);
  dbConnection.save();
  res.status(201).json(newTicket);
});

app.get("/api/admin/tickets", requireAdminOrEditor as unknown as express.RequestHandler, (req: Request, res: Response) => {
  res.json(dbConnection.getTickets());
});

app.put("/api/admin/tickets/:id", requireAdminOrEditor as unknown as express.RequestHandler, (req: Request, res: Response) => {
  const { id } = req.params;
  const { reply, status } = req.body;
  const tickets = dbConnection.getTickets();
  const ticket = tickets.find(t => t.id === id);
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });

  if (reply !== undefined) ticket.reply = reply;
  if (status) ticket.status = status;

  dbConnection.save();
  res.json(ticket);
});

// 5. AUTH API
app.post("/api/auth/register", (req: Request, res: Response) => {
  const { email, password, name, role } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: "Email, password, and name are required" });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  const branding = dbConnection.getBranding();
  if (!branding.allowRegistration) {
    return res.status(400).json({ error: "Registration is temporarily closed by Administrator." });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  // People can only sign up as student or teacher. Editor/admin is granted by an admin,
  // or automatically for emails listed in ADMIN_EMAILS.
  let registeredRole: "student" | "teacher" | "admin" = REGISTERABLE_ROLES.includes(role) ? role : "student";
  if (config.ADMIN_EMAILS.includes(normalizedEmail)) {
    registeredRole = "admin";
  }

  const users = dbConnection.getUsers();
  if (users.find(u => u.email.toLowerCase() === normalizedEmail)) {
    return res.status(400).json({ error: "This email is already registered" });
  }

  const newUser = {
    id: "usr_" + crypto.randomBytes(6).toString("hex"),
    email: normalizedEmail,
    name: String(name).trim(),
    role: registeredRole,
    bookmarks: [] as string[],
    isBlocked: false,
    createdAt: new Date().toISOString(),
    passwordHash: dbConnection.hashPassword(password)
  };

  users.push(newUser);
  dbConnection.save();

  const token = dbConnection.createToken(newUser);
  res.status(201).json({ user: publicUser(newUser), token });
});

app.post("/api/auth/login", (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  if (tooManyAttempts(`login:${req.ip}:${normalizedEmail}`, 10, 15 * 60 * 1000)) {
    return res.status(429).json({ error: "Too many login attempts. Please wait 15 minutes and try again." });
  }

  const users = dbConnection.getUsers();
  const user = users.find(u => u.email.toLowerCase() === normalizedEmail);
  if (!user || !dbConnection.verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  if (user.isBlocked) {
    return res.status(403).json({ error: "This account has been blocked by an administrator." });
  }

  // Upgrade old static-salt hashes to the new format
  if (dbConnection.isLegacyHash(user.passwordHash)) {
    user.passwordHash = dbConnection.hashPassword(password);
    dbConnection.save();
  }

  const token = dbConnection.createToken(user);
  res.json({ user: publicUser(user), token });
});

app.get("/api/users/me", (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Not logged in" });
  }
  const user = dbConnection.getUsers().find(u => u.id === req.user!.id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  if (user.isBlocked) {
    return res.status(403).json({ error: "This account has been blocked by an administrator." });
  }
  res.json(publicUser(user));
});

// Update Profile Detail (Name, email, password change)
app.post("/api/users/profile", requireAuth as unknown as express.RequestHandler, (req: AuthenticatedRequest, res: Response) => {
  const { name, email, currentPassword, newPassword } = req.body;
  const users = dbConnection.getUsers();
  const user = users.find(u => u.id === req.user!.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  if (newPassword) {
    if (!currentPassword || !dbConnection.verifyPassword(currentPassword, user.passwordHash)) {
      return res.status(400).json({ error: "Current password is incorrect." });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters." });
    }
  }

  if (email && email.toLowerCase() !== user.email.toLowerCase()) {
    const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      return res.status(400).json({ error: "This email is already used by another account." });
    }
    user.email = String(email).trim().toLowerCase();
  }

  if (name) user.name = String(name).trim();
  if (newPassword) user.passwordHash = dbConnection.hashPassword(newPassword);

  dbConnection.save();
  res.json({ success: true, user: publicUser(user) });
});

// Password recovery. There is no email sending yet, so in production the code is only
// written to the server log (docker logs) and an admin can pass it on to the user.
app.post("/api/auth/forgot-password", (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  if (tooManyAttempts(`forgot:${req.ip}`, 5, 15 * 60 * 1000)) {
    return res.status(429).json({ error: "Too many requests. Please wait 15 minutes and try again." });
  }

  const user = dbConnection.getUsers().find(u => u.email.toLowerCase() === String(email).toLowerCase());
  const code = crypto.randomInt(100000, 1000000).toString();

  if (user) {
    user.resetCodeHash = crypto.createHash("sha256").update(code).digest("hex");
    user.resetCodeExpires = Date.now() + 15 * 60 * 1000;
    dbConnection.save();
    console.log(`[Password reset] Code for ${user.email}: ${code} (valid 15 minutes)`);
  }

  if (config.isProduction) {
    res.json({
      success: true,
      message: "If an account exists for that email, a reset code has been created. Contact the department admin to receive it."
    });
  } else {
    res.json({
      success: true,
      simulated: true,
      code: user ? code : undefined,
      message: user
        ? `[DEV] Password reset code: ${code}`
        : "[DEV] No account with that email."
    });
  }
});

app.post("/api/auth/reset-password", (req: Request, res: Response) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: "Email, code and new password are required." });
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters." });
  }

  if (tooManyAttempts(`reset:${req.ip}`, 10, 15 * 60 * 1000)) {
    return res.status(429).json({ error: "Too many attempts. Please wait 15 minutes and try again." });
  }

  const user = dbConnection.getUsers().find(u => u.email.toLowerCase() === String(email).toLowerCase());
  const codeHash = crypto.createHash("sha256").update(String(code).trim()).digest("hex");

  if (
    !user ||
    !user.resetCodeHash ||
    !user.resetCodeExpires ||
    Date.now() > user.resetCodeExpires ||
    user.resetCodeHash !== codeHash
  ) {
    return res.status(400).json({ error: "The reset code is wrong or has expired." });
  }

  user.passwordHash = dbConnection.hashPassword(newPassword);
  delete user.resetCodeHash;
  delete user.resetCodeExpires;
  dbConnection.save();

  res.json({ success: true, message: "Your password has been updated. Please log in." });
});

// Admin Route: Get Users List (Super admin only)
app.get("/api/admin/users", requireSuperAdmin as unknown as express.RequestHandler, (req: Request, res: Response) => {
  const users = dbConnection.getUsers();
  res.json(users.map(publicUser));
});

// Super Admin Route: Block/Unblock user
app.post("/api/admin/users/:id/block", requireSuperAdmin as unknown as express.RequestHandler, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const users = dbConnection.getUsers();
  const user = users.find(u => u.id === id);
  if (!user) return res.status(404).json({ error: "User profile detail not found" });

  if (id === "usr_admin" || id === req.user!.id) return res.status(400).json({ error: "You cannot block this account." });

  user.isBlocked = true;
  dbConnection.save();
  res.json({ success: true, user: { id: user.id, isBlocked: true } });
});

app.post("/api/admin/users/:id/unblock", requireSuperAdmin as unknown as express.RequestHandler, (req: Request, res: Response) => {
  const { id } = req.params;
  const users = dbConnection.getUsers();
  const user = users.find(u => u.id === id);
  if (!user) return res.status(404).json({ error: "User profile detail not found" });

  user.isBlocked = false;
  dbConnection.save();
  res.json({ success: true, user: { id: user.id, isBlocked: false } });
});

// Super Admin Route: Promote role
app.post("/api/admin/users/:id/role", requireSuperAdmin as unknown as express.RequestHandler, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { role } = req.body;
  if (!ALL_ROLES.includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }
  if (id === req.user!.id) {
    return res.status(400).json({ error: "You cannot change your own role." });
  }

  const users = dbConnection.getUsers();
  const user = users.find(u => u.id === id);
  if (!user) return res.status(404).json({ error: "User not found" });

  if (id === "usr_admin") return res.status(400).json({ error: "The main administrator's role cannot be changed." });

  user.role = role;
  dbConnection.save();
  res.json({ success: true, user: { id: user.id, role: user.role } });
});

// Super Admin Route: Delete User
app.delete("/api/admin/users/:id", requireSuperAdmin as unknown as express.RequestHandler, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const users = dbConnection.getUsers();
  const index = users.findIndex(u => u.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "User not found" });
  }
  if (id === "usr_admin" || id === req.user!.id) {
    return res.status(400).json({ error: "This account cannot be deleted." });
  }
  users.splice(index, 1);
  dbConnection.save();
  res.json({ success: true, message: "User deleted successfully" });
});

// PAPER FILE: inline preview (iframe) or download (?download=1)
app.get("/api/papers/:id/file", async (req: AuthenticatedRequest, res: Response) => {
  const paper = dbConnection.getPapers().find(p => p.id === req.params.id);
  if (!paper) {
    return res.status(404).json({ error: "Paper not found" });
  }
  // Hidden papers are only available to admins/editors and the uploader
  if (paper.status !== "Active" && !isElevatedUser(req) && paper.uploaderId !== req.user?.id) {
    return res.status(404).json({ error: "Paper not found" });
  }

  const wantsDownload = req.query.download === "1";
  if (wantsDownload) {
    paper.downloadsCount = (paper.downloadsCount || 0) + 1;
    dbConnection.save();
  }

  // Externally hosted PDF (e.g. IEEE Xplore / Google Drive link)
  if (/^https?:\/\//i.test(paper.fileUrl)) {
    return res.redirect(paper.fileUrl);
  }

  const safeTitle = (paper.title || "paper").trim().replace(/[^a-zA-Z0-9\-_ ]/g, "_").substring(0, 120) + ".pdf";
  const disposition = `${wantsDownload ? "attachment" : "inline"}; filename="${safeTitle}"`;

  const f = await openUpload(paper.fileUrl);
  if (f) {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", disposition);
    res.setHeader("Content-Length", String(f.size));
    f.stream.on("error", () => res.end());
    return f.stream.pipe(res);
  }

  // Demo papers (SEED_DEMO_DATA) have no real file: send a one-page placeholder PDF
  if (paper.fileUrl && paper.fileUrl.startsWith("/sample-papers/")) {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", disposition);
    return res.send(buildPlaceholderPdf(paper.title));
  }

  return res.status(404).json({ error: "The PDF file for this paper is missing on the server." });
});

// Minimal valid one-page PDF with the paper title, used only for demo data
function buildPlaceholderPdf(title: string): Buffer {
  const clean = (title || "Sample paper").replace(/[^\x20-\x7E]/g, "").replace(/[()\\]/g, "");
  const lines: string[] = [];
  let line = "";
  for (const word of clean.split(" ")) {
    if ((line + " " + word).trim().length > 60) { lines.push(line.trim()); line = word; }
    else line += " " + word;
  }
  if (line.trim()) lines.push(line.trim());
  const text = [
    "BT /F1 16 Tf 60 760 Td 20 TL",
    ...lines.map(l => `(${l}) '`),
    "/F1 11 Tf () ' (Demo record - no PDF has been uploaded for this paper.) '",
    "ET"
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach(o => { pdf += `${String(o).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

// 6. PAPERS API
app.get("/api/papers", (req: Request, res: Response) => {
  const { q, topic, type, supervisor, researcher, status } = req.query;
  let list = [...dbConnection.getPapers()];

  // Hidden papers: visible to admins/editors, and to the person who uploaded them
  const authReq = req as AuthenticatedRequest;
  const isElevated = isElevatedUser(authReq);

  if (!isElevated) {
    list = list.filter(p => p.status === "Active" || (authReq.user && p.uploaderId === authReq.user.id));
  } else if (status) {
    list = list.filter(p => p.status === status);
  }

  if (q) {
    const queryStr = String(q).toLowerCase();
    list = list.filter(p => 
      p.title.toLowerCase().includes(queryStr) ||
      p.summary.toLowerCase().includes(queryStr) ||
      p.authors.some(a => a.toLowerCase().includes(queryStr)) ||
      (p.supervisor && p.supervisor.toLowerCase().includes(queryStr)) ||
      (p.coSupervisor && p.coSupervisor.toLowerCase().includes(queryStr)) ||
      (p.publicationType && p.publicationType.toLowerCase().includes(queryStr)) ||
      (p.keywords && p.keywords.some(k => k.toLowerCase().includes(queryStr))) ||
      p.categories.some(c => c.toLowerCase().includes(queryStr))
    );
  }

  if (topic && topic !== "All") {
    const topicStr = String(topic).toLowerCase();
    list = list.filter(p => p.categories.some(c => c.toLowerCase() === topicStr));
  }

  if (type && type !== "All") {
    const typeStr = String(type).toLowerCase();
    list = list.filter(p => p.publicationType && p.publicationType.toLowerCase() === typeStr);
  }

  if (supervisor && supervisor !== "All") {
    const supStr = String(supervisor).toLowerCase();
    list = list.filter(p => p.supervisor && p.supervisor.toLowerCase().includes(supStr));
  }

  if (researcher) {
    const resStr = String(researcher).toLowerCase();
    list = list.filter(p => p.researcherId === resStr || p.authors.some(a => a.toLowerCase().includes(resStr)));
  }

  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(list);
});

app.post("/api/papers", requireAuth as unknown as express.RequestHandler, (req: AuthenticatedRequest, res: Response) => {
  const { 
    title, 
    authors, 
    supervisor, 
    coSupervisor, 
    publicationType, 
    keywords, 
    year, 
    pages, 
    categories, 
    summary, 
    fileUrl, 
    researcherId, 
    coverImage, 
    status 
  } = req.body;
  if (!title || !authors || !year || !summary || !fileUrl) {
    return res.status(400).json({ error: "Title, authors, year, abstract and PDF file are required" });
  }
  if (!String(fileUrl).startsWith("/uploads/") && !/^https?:\/\//i.test(String(fileUrl))) {
    return res.status(400).json({ error: "Invalid PDF file reference" });
  }

  const paperList = dbConnection.getPapers();

  let resolvedResearcherId = researcherId;
  if (!resolvedResearcherId && req.user) {
    const researchers = dbConnection.getResearchers();
    const match = researchers.find(
      r => r.userId === req.user!.id || (r.email && r.email.toLowerCase() === req.user!.email.toLowerCase())
    );
    if (match) {
      resolvedResearcherId = match.id;
    }
  }

  const newPaper: Paper = {
    id: "paper_" + crypto.randomBytes(6).toString("hex"),
    title,
    authors: Array.isArray(authors) ? authors : [authors],
    supervisor: supervisor ? String(supervisor).trim() : undefined,
    coSupervisor: coSupervisor ? String(coSupervisor).trim() : undefined,
    publicationType: publicationType || "Undergraduate Thesis",
    keywords: Array.isArray(keywords) ? keywords : (keywords ? String(keywords).split(",").map(k => k.trim()).filter(Boolean) : []),
    year: Number(year),
    pages: Number(pages || 10),
    views: 0,
    likes: 0,
    downloadsCount: 0,
    categories: Array.isArray(categories) ? categories : [categories],
    summary,
    fileUrl,
    researcherId: resolvedResearcherId || undefined,
    uploaderId: req.user?.id,
    coverImage: coverImage || "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=600&auto=format&fit=crop&q=80",
    // Only admins/editors can add a paper as hidden
    status: isElevatedUser(req) && status === "Inactive" ? "Inactive" : "Active",
    createdAt: new Date().toISOString()
  };

  newPaper.textStatus = pdfTextAvailable() && resolveUploadPath(newPaper.fileUrl) ? "pending" : "unavailable";
  paperList.push(newPaper);
  dbConnection.save();

  searchIndex.indexPaper(newPaper);
  if (newPaper.textStatus === "pending") ocrQueue.enqueue(newPaper.id);

  res.status(201).json(newPaper);
});

app.put("/api/papers/:id", requireAdminOrEditor as unknown as express.RequestHandler, (req: Request, res: Response) => {
  const { id } = req.params;
  const { 
    title, 
    authors, 
    supervisor, 
    coSupervisor, 
    publicationType, 
    keywords, 
    year, 
    pages, 
    categories, 
    summary, 
    fileUrl, 
    researcherId, 
    coverImage, 
    status 
  } = req.body;

  const papers = dbConnection.getPapers();
  const paper = papers.find(p => p.id === id);
  if (!paper) {
    return res.status(404).json({ error: "Paper not found" });
  }

  const oldFileUrl = paper.fileUrl;
  if (title) paper.title = title;
  if (authors) paper.authors = Array.isArray(authors) ? authors : [authors];
  if (supervisor !== undefined) paper.supervisor = supervisor ? String(supervisor).trim() : undefined;
  if (coSupervisor !== undefined) paper.coSupervisor = coSupervisor ? String(coSupervisor).trim() : undefined;
  if (publicationType) paper.publicationType = publicationType;
  if (keywords !== undefined) paper.keywords = Array.isArray(keywords) ? keywords : String(keywords).split(",").map(k => k.trim()).filter(Boolean);
  if (year) paper.year = Number(year);
  if (pages) paper.pages = Number(pages);
  if (categories) paper.categories = Array.isArray(categories) ? categories : [categories];
  if (summary) paper.summary = summary;
  if (fileUrl) paper.fileUrl = fileUrl;
  if (coverImage) paper.coverImage = coverImage;
  if (status) paper.status = status;
  if (researcherId !== undefined) paper.researcherId = researcherId || undefined;

  if (paper.fileUrl !== oldFileUrl) {
    deleteFileText(oldFileUrl);
    paper.textStatus = pdfTextAvailable() && resolveUploadPath(paper.fileUrl) ? "pending" : "unavailable";
  }
  dbConnection.save();
  searchIndex.indexPaper(paper);
  if (paper.fileUrl !== oldFileUrl && paper.textStatus === "pending") ocrQueue.enqueue(paper.id);
  res.json(paper);
});

app.delete("/api/papers/:id", requireAuth as unknown as express.RequestHandler, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const papers = dbConnection.getPapers();
  const index = papers.findIndex(p => p.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Paper not found" });
  }
  const paper = papers[index];
  const isUploader = !!req.user && paper.uploaderId === req.user.id;
  if (!isElevatedUser(req) && !isUploader) {
    return res.status(403).json({ error: "Only the person who uploaded this paper or an admin can delete it" });
  }

  ocrQueue.cancel(paper.id);
  searchIndex.removePaper(paper.id);
  deleteFileText(paper.fileUrl);
  deleteUploadedFile(paper.fileUrl);
  deleteUploadedFile(paper.coverImage);

  // Remove the paper from everyone's bookmarks
  dbConnection.getUsers().forEach(u => {
    if (u.bookmarks?.includes(id)) u.bookmarks = u.bookmarks.filter(b => b !== id);
  });

  papers.splice(index, 1);
  dbConnection.save();
  res.json({ success: true, message: "Paper deleted successfully" });
});

app.post("/api/papers/:id/like", (req: Request, res: Response) => {
  const { id } = req.params;
  const papers = dbConnection.getPapers();
  const paper = papers.find(p => p.id === id);
  if (!paper) {
    return res.status(404).json({ error: "Paper not found" });
  }
  paper.likes += 1;
  dbConnection.save();
  res.json({ liked: true, likes: paper.likes });
});

app.post("/api/papers/:id/view", (req: Request, res: Response) => {
  const { id } = req.params;
  const papers = dbConnection.getPapers();
  const paper = papers.find(p => p.id === id);
  if (!paper) {
    return res.status(404).json({ error: "Paper not found" });
  }
  paper.views += 1;
  dbConnection.save();
  res.json({ viewed: true, views: paper.views });
});

// Bookmark operations
app.post("/api/papers/:id/bookmark", requireAuth as unknown as express.RequestHandler, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const users = dbConnection.getUsers();
  const user = users.find(u => u.id === req.user!.id);
  if (!user) {
    return res.status(404).json({ error: "User verification error" });
  }

  if (!user.bookmarks.includes(id)) {
    user.bookmarks.push(id);
    dbConnection.save();
  }

  res.json({ bookmarked: true, bookmarks: user.bookmarks });
});

app.post("/api/papers/:id/unbookmark", requireAuth as unknown as express.RequestHandler, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const users = dbConnection.getUsers();
  const user = users.find(u => u.id === req.user!.id);
  if (!user) {
    return res.status(404).json({ error: "User verification error" });
  }

  user.bookmarks = user.bookmarks.filter(bId => bId !== id);
  dbConnection.save();

  res.json({ bookmarked: false, bookmarks: user.bookmarks });
});

// 7. TOPICS API
app.get("/api/topics", (req: Request, res: Response) => {
  res.json(dbConnection.getTopics());
});

app.post("/api/topics", requireAdminOrEditor as unknown as express.RequestHandler, (req: Request, res: Response) => {
  const { name, description } = req.body;
  if (!name || !description) {
    return res.status(400).json({ error: "Name and description are required topic assets" });
  }

  const topics = dbConnection.getTopics();
  const formatName = name.trim();
  const existing = topics.find(t => t.name.toLowerCase() === formatName.toLowerCase());
  if (existing) {
    return res.status(400).json({ error: "Topic already exists" });
  }

  const newTopic: Topic = {
    id: "topic_" + Math.random().toString(36).substring(2, 11),
    name: formatName,
    description
  };

  topics.push(newTopic);
  dbConnection.save();
  res.status(201).json(newTopic);
});

app.put("/api/topics/:id", requireAdminOrEditor as unknown as express.RequestHandler, (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description } = req.body;

  const topics = dbConnection.getTopics();
  const topic = topics.find(t => t.id === id);
  if (!topic) {
    return res.status(404).json({ error: "Topic not found" });
  }

  if (name) topic.name = name;
  if (description) topic.description = description;

  dbConnection.save();
  res.json(topic);
});

app.delete("/api/topics/:id", requireAdminOrEditor as unknown as express.RequestHandler, (req: Request, res: Response) => {
  const { id } = req.params;
  const topics = dbConnection.getTopics();
  const index = topics.findIndex(t => t.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Topic not found" });
  }
  topics.splice(index, 1);
  dbConnection.save();
  res.json({ success: true });
});

// 8. RESEARCHERS API
app.get("/api/researchers", (req: Request, res: Response) => {
  res.json(dbConnection.getResearchers());
});

app.post("/api/researchers", requireAuth as unknown as express.RequestHandler, (req: AuthenticatedRequest, res: Response) => {
  const { name, affiliation, position, bio, email, website, profilePhoto, userId } = req.body;
  if (!name || !affiliation) {
    return res.status(400).json({ error: "Name and affiliation are required researcher credentials" });
  }

  const researchers = dbConnection.getResearchers();
  // Normal users can only create a profile for their own account
  const resolvedUserId = isElevatedUser(req) ? (userId || req.user?.id) : req.user?.id;

  if (resolvedUserId) {
    const existing = researchers.find(r => r.userId === resolvedUserId);
    if (existing) {
      return res.status(400).json({ error: "A researcher profile has already been registered for this account." });
    }
  }

  const newResearcher: Researcher = {
    id: "res_" + Math.random().toString(36).substring(2, 11),
    name,
    affiliation,
    position: position || "Researcher",
    bio: bio || "",
    email: email || req.user?.email || "",
    website: website || "",
    profilePhoto: profilePhoto || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    userId: resolvedUserId
  };

  researchers.push(newResearcher);
  dbConnection.save();
  res.status(201).json(newResearcher);
});

app.put("/api/researchers/:id", requireAuth as unknown as express.RequestHandler, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { name, affiliation, position, bio, email, website, profilePhoto, userId } = req.body;

  const researchers = dbConnection.getResearchers();
  const resProfile = researchers.find(r => r.id === id);
  if (!resProfile) {
    return res.status(404).json({ error: "Researcher not found" });
  }

  const isElevated = isElevatedUser(req);
  const isOwner = !!req.user && resProfile.userId === req.user.id;

  if (!isElevated && !isOwner) {
    return res.status(403).json({ error: "Privilege violation: you do not own this researcher record" });
  }

  if (name) resProfile.name = name;
  if (affiliation) resProfile.affiliation = affiliation;
  if (position) resProfile.position = position;
  if (bio !== undefined) resProfile.bio = bio;
  if (email) resProfile.email = email;
  if (website !== undefined) resProfile.website = website;
  if (profilePhoto) resProfile.profilePhoto = profilePhoto;
  if (userId !== undefined && isElevated) resProfile.userId = userId || undefined;

  dbConnection.save();
  res.json(resProfile);
});

app.delete("/api/researchers/:id", requireAdminOrEditor as unknown as express.RequestHandler, (req: Request, res: Response) => {
  const { id } = req.params;
  const researchers = dbConnection.getResearchers();
  const index = researchers.findIndex(r => r.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Researcher not found" });
  }
  researchers.splice(index, 1);
  dbConnection.save();
  res.json({ success: true });
});

// 9. UPLOAD FILE API (MULTIPART/FORM-DATA)
app.post("/api/upload", requireAuth as unknown as express.RequestHandler, (req: Request, res: Response, next: NextFunction) => {
  upload.single("file")(req, res, (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ error: `File is too large. The maximum is ${config.MAX_UPLOAD_MB} MB.` });
        }
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      }
      return res.status(400).json({ error: err.message || "File upload failed" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file attached to upload request or file format rejected." });
    }

    const file = req.file;
    persistUpload(file.filename).then(() => {
      res.status(201).json({
        success: true,
        fileUrl: `/uploads/${file.filename}`,
        fileName: file.filename,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype
      });
    }).catch((e) => {
      console.error("[Files] Could not store upload:", e);
      deleteUploadedFile(`/uploads/${file.filename}`);
      res.status(500).json({ error: "Could not store the file. The storage may be full." });
    });
  });
});

// 10. CHATS API
app.get("/api/chats/users", requireAuth as unknown as express.RequestHandler, (req: AuthenticatedRequest, res: Response) => {
  const users = dbConnection.getUsers();
  const currentUserId = req.user!.id;
  
  const chatUsers = users
    .filter(u => u.id !== currentUserId && !u.isBlocked)
    .map(u => ({
      id: u.id,
      name: u.name,
      role: u.role,
      email: u.email
    }));
  res.json(chatUsers);
});

app.get("/api/chats", requireAuth as unknown as express.RequestHandler, (req: AuthenticatedRequest, res: Response) => {
  const currentUserId = req.user!.id;
  const chats = dbConnection.getChats();
  
  const myChats = chats.filter(c => c.senderId === currentUserId || c.receiverId === currentUserId);
  res.json(myChats);
});

app.post("/api/chats", requireAuth as unknown as express.RequestHandler, (req: AuthenticatedRequest, res: Response) => {
  const { receiverId, message } = req.body;
  if (!receiverId || !message || !message.trim()) {
    return res.status(400).json({ error: "Receiver and message are required" });
  }

  const currentUserId = req.user!.id;
  const users = dbConnection.getUsers();
  
  const senderUser = users.find(u => u.id === currentUserId);
  const receiverUser = users.find(u => u.id === receiverId);
  
  if (!senderUser || !receiverUser) {
    return res.status(404).json({ error: "User not found" });
  }

  if (String(message).length > 5000) {
    return res.status(400).json({ error: "Message is too long (max 5000 characters)" });
  }

  const chats = dbConnection.getChats();
  const newMsg = {
    id: "msg_" + crypto.randomBytes(6).toString("hex"),
    senderId: currentUserId,
    senderName: senderUser.name,
    senderRole: senderUser.role,
    receiverId,
    receiverName: receiverUser.name,
    receiverRole: receiverUser.role,
    message: message.trim(),
    createdAt: new Date().toISOString()
  };

  chats.push(newMsg);
  dbConnection.save();

  res.status(201).json(newMsg);
});

// 11. PROJECTS API (SOFTWARE & HARDWARE PROJECTS SHOWCASE)
app.get("/api/projects", (req: Request, res: Response) => {
  const { q, category, status, batch } = req.query;
  let list = [...dbConnection.getProjects()];

  if (category && category !== "All") {
    list = list.filter(p => p.category.toLowerCase() === String(category).toLowerCase() || (category === "IoT" && p.category.includes("IoT")));
  }

  if (status && status !== "All") {
    list = list.filter(p => p.status.toLowerCase() === String(status).toLowerCase());
  }

  if (batch && batch !== "All") {
    list = list.filter(p => p.batch && p.batch.toLowerCase().includes(String(batch).toLowerCase()));
  }

  if (q) {
    const queryStr = String(q).toLowerCase();
    list = list.filter(p =>
      p.title.toLowerCase().includes(queryStr) ||
      p.description.toLowerCase().includes(queryStr) ||
      p.category.toLowerCase().includes(queryStr) ||
      (p.supervisor && p.supervisor.toLowerCase().includes(queryStr)) ||
      (p.batch && p.batch.toLowerCase().includes(queryStr)) ||
      p.teamMembers.some(m => m.toLowerCase().includes(queryStr)) ||
      p.techStack.some(t => t.toLowerCase().includes(queryStr))
    );
  }

  // Sort: featured first, then newest
  list.sort((a, b) => {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  res.json(list);
});

app.get("/api/projects/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const projects = dbConnection.getProjects();
  const project = projects.find(p => p.id === id);
  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }
  res.json(project);
});

app.post("/api/projects", requireAuth as unknown as express.RequestHandler, (req: AuthenticatedRequest, res: Response) => {
  const {
    title,
    category,
    teamMembers,
    supervisor,
    batch,
    academicYear,
    description,
    techStack,
    demoImages,
    coverImage,
    githubUrl,
    liveDemoUrl,
    documentationUrl,
    status
  } = req.body;

  if (!title || !description) {
    return res.status(400).json({ error: "Project title and comprehensive description are required." });
  }

  const projects = dbConnection.getProjects();
  const id = "proj_" + crypto.randomBytes(6).toString("hex");

  const formattedCategory = (category === "Hardware" || category === "Hybrid / IoT" || category === "Software")
    ? category
    : "Software";

  const formattedTeam = Array.isArray(teamMembers)
    ? teamMembers.filter(Boolean)
    : (teamMembers ? String(teamMembers).split(",").map(t => t.trim()).filter(Boolean) : [req.user?.email || "CSE Student"]);

  const formattedTech = Array.isArray(techStack)
    ? techStack.filter(Boolean)
    : (techStack ? String(techStack).split(",").map(t => t.trim()).filter(Boolean) : []);

  const formattedImages = Array.isArray(demoImages)
    ? demoImages.filter(Boolean)
    : (demoImages ? [demoImages] : []);

  const selectedCover = coverImage || (formattedImages.length > 0 ? formattedImages[0] : "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80");

  const newProject: Project = {
    id,
    title: title.trim(),
    category: formattedCategory,
    teamMembers: formattedTeam,
    supervisor: supervisor ? String(supervisor).trim() : undefined,
    batch: batch ? String(batch).trim() : undefined,
    academicYear: academicYear ? Number(academicYear) : new Date().getFullYear(),
    description: description.trim(),
    techStack: formattedTech,
    demoImages: formattedImages.length > 0 ? formattedImages : [selectedCover],
    coverImage: selectedCover,
    githubUrl: githubUrl ? String(githubUrl).trim() : undefined,
    liveDemoUrl: liveDemoUrl ? String(liveDemoUrl).trim() : undefined,
    documentationUrl: documentationUrl ? String(documentationUrl).trim() : undefined,
    status: ["Completed", "Ongoing", "Prototype"].includes(status) ? status : "Completed",
    likes: 0,
    views: 0,
    featured: req.user?.role === "admin",
    createdBy: req.user?.id,
    createdAt: new Date().toISOString()
  };

  projects.unshift(newProject);
  dbConnection.save();

  res.status(201).json(newProject);
});

app.put("/api/projects/:id", requireAuth as unknown as express.RequestHandler, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const projects = dbConnection.getProjects();
  const project = projects.find(p => p.id === id);
  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }

  const isElevated = isElevatedUser(req);
  const isAuthor = !!req.user && project.createdBy === req.user.id;

  if (!isElevated && !isAuthor) {
    return res.status(403).json({ error: "Permission denied: Only the project author or department admin can edit this project." });
  }

  const {
    title,
    category,
    teamMembers,
    supervisor,
    batch,
    academicYear,
    description,
    techStack,
    demoImages,
    coverImage,
    githubUrl,
    liveDemoUrl,
    documentationUrl,
    status,
    featured
  } = req.body;

  if (title) project.title = title.trim();
  if (category === "Software" || category === "Hardware" || category === "Hybrid / IoT") project.category = category;
  if (teamMembers) project.teamMembers = Array.isArray(teamMembers) ? teamMembers : String(teamMembers).split(",").map(t => t.trim()).filter(Boolean);
  if (supervisor !== undefined) project.supervisor = supervisor ? String(supervisor).trim() : undefined;
  if (batch !== undefined) project.batch = batch ? String(batch).trim() : undefined;
  if (academicYear) project.academicYear = Number(academicYear);
  if (description) project.description = description.trim();
  if (techStack) project.techStack = Array.isArray(techStack) ? techStack : String(techStack).split(",").map(t => t.trim()).filter(Boolean);
  if (demoImages) project.demoImages = Array.isArray(demoImages) ? demoImages : [demoImages];
  if (coverImage) project.coverImage = coverImage;
  if (githubUrl !== undefined) project.githubUrl = githubUrl ? String(githubUrl).trim() : undefined;
  if (liveDemoUrl !== undefined) project.liveDemoUrl = liveDemoUrl ? String(liveDemoUrl).trim() : undefined;
  if (documentationUrl !== undefined) project.documentationUrl = documentationUrl ? String(documentationUrl).trim() : undefined;
  if (status) project.status = status;
  if (featured !== undefined && isElevated) project.featured = !!featured;

  dbConnection.save();
  res.json(project);
});

app.delete("/api/projects/:id", requireAuth as unknown as express.RequestHandler, (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const projects = dbConnection.getProjects();
  const index = projects.findIndex(p => p.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Project not found" });
  }

  const project = projects[index];
  const isElevated = isElevatedUser(req);
  const isAuthor = !!req.user && project.createdBy === req.user.id;

  if (!isElevated && !isAuthor) {
    return res.status(403).json({ error: "Permission denied: Only the project author or department admin can delete this project." });
  }

  projects.splice(index, 1);
  dbConnection.save();
  res.json({ success: true, message: "Project deleted successfully." });
});

app.post("/api/projects/:id/like", (req: Request, res: Response) => {
  const { id } = req.params;
  const projects = dbConnection.getProjects();
  const project = projects.find(p => p.id === id);
  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }
  project.likes = (project.likes || 0) + 1;
  dbConnection.save();
  res.json({ liked: true, likes: project.likes });
});

app.post("/api/projects/:id/view", (req: Request, res: Response) => {
  const { id } = req.params;
  const projects = dbConnection.getProjects();
  const project = projects.find(p => p.id === id);
  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }
  project.views = (project.views || 0) + 1;
  dbConnection.save();
  res.json({ viewed: true, views: project.views });
});

// 12. FULL-TEXT SEARCH (titles, abstracts and the text inside every PDF page)
app.get("/api/search", (req: AuthenticatedRequest, res: Response) => {
  const q = String(req.query.q || "").trim().slice(0, 200);
  if (q.length < 2) return res.json([]);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "30"), 10) || 30));
  res.json(searchIndex.search(q, paperVisibility(req), limit));
});

// 13. AI FEATURES
// Who is asking: a logged-in user, or a guest counted by IP address
function aiCaller(req: AuthenticatedRequest): { id: string; role: string } | null {
  if (req.user) return { id: req.user.id, role: req.user.role };
  if (config.AI.ALLOW_GUESTS) return { id: `guest:${req.ip}`, role: "guest" };
  return null;
}

app.get("/api/ai/status", (req: AuthenticatedRequest, res: Response) => {
  const caller = aiCaller(req);
  res.json({
    enabled: config.AI.ENABLED,
    allowGuests: config.AI.ALLOW_GUESTS,
    pdfTextAvailable: pdfTextAvailable(),
    ocrAvailable: ocrAvailable(),
    ocrLangs: ocrTools.langs,
    remainingToday: caller && config.AI.ENABLED ? remainingFor(caller.id, caller.role) : undefined
  });
});

function sendAiError(res: Response, e: any) {
  const status = e instanceof AiError ? e.status : 500;
  if (!(e instanceof AiError)) console.error("[AI] Unexpected error:", e);
  res.status(status).json({ error: e instanceof AiError ? e.message : "AI request failed" });
}

// Upload assistant: start reading an uploaded PDF and suggesting form fields
app.post("/api/ai/extract-metadata", requireAuth as unknown as express.RequestHandler, (req: AuthenticatedRequest, res: Response) => {
  if (!config.AI.ENABLED) return res.status(503).json({ error: "AI is not configured on this server" });
  const fileUrl = String(req.body?.fileUrl || "");
  const filePath = resolveUploadPath(fileUrl);
  if (!filePath || !filePath.toLowerCase().endsWith(".pdf") || !fs.existsSync(filePath)) {
    return res.status(400).json({ error: "Upload the PDF first" });
  }
  try {
    res.status(202).json(startMetadataJob(fileUrl, req.user!.id, req.user!.role));
  } catch (e) {
    sendAiError(res, e);
  }
});

app.get("/api/ai/extract-metadata/:jobId", requireAuth as unknown as express.RequestHandler, (req: AuthenticatedRequest, res: Response) => {
  const job = getMetadataJob(req.params.jobId, req.user!.id);
  if (!job) return res.status(404).json({ error: "Job not found or expired" });
  res.json(job);
});

// Ask the archive
// Ask the archive (works without login when AI_ALLOW_GUESTS is not "false")
app.post("/api/ai/ask", async (req: AuthenticatedRequest, res: Response) => {
  if (!config.AI.ENABLED) return res.status(503).json({ error: "AI is not configured on this server" });
  if (req.user && isBlocked(req)) return res.status(403).json({ error: "Your account has been blocked by an administrator." });
  const caller = aiCaller(req);
  if (!caller) return res.status(401).json({ error: "Please log in to use the AI assistant" });
  const question = String(req.body?.question || "").trim();
  if (question.length < 3) return res.status(400).json({ error: "Please write a question" });
  if (question.length > 1000) return res.status(400).json({ error: "Question is too long (max 1000 characters)" });
  const history = (Array.isArray(req.body?.history) ? req.body.history : [])
    .filter((h: any) => h && (h.role === "user" || h.role === "assistant") && typeof h.content === "string")
    .slice(-6);

  try {
    consumeQuota(caller.id, caller.role);
  } catch (e) {
    return sendAiError(res, e);
  }
  try {
    const result = await askArchive(question, history, paperVisibility(req));
    res.json({ ...result, remainingToday: remainingFor(caller.id, caller.role) });
  } catch (e) {
    refundQuota(caller.id);
    sendAiError(res, e);
  }
});

// Admin: run text extraction / OCR again for one paper (force = OCR every page, e.g. for Bijoy-font PDFs)
app.post("/api/admin/papers/:id/reprocess", requireAdminOrEditor as unknown as express.RequestHandler, (req: Request, res: Response) => {
  const paper = dbConnection.getPapers().find(p => p.id === req.params.id);
  if (!paper) return res.status(404).json({ error: "Paper not found" });
  if (!resolveUploadPath(paper.fileUrl)) return res.status(400).json({ error: "This paper has no uploaded PDF" });
  ocrQueue.enqueue(paper.id, !!req.body?.force);
  dbConnection.save();
  res.json({ success: true, textStatus: paper.textStatus });
});

// Unknown API routes return JSON 404 (instead of falling through to the SPA)
app.use("/api", (req: Request, res: Response) => {
  res.status(404).json({ error: "API route not found" });
});

// Error handling middleware to return JSON instead of HTML
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Express middleware error caught:", err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: status >= 500 && config.isProduction ? "Internal server error" : (err.message || "Internal server error")
  });
});

// --- VITE AND SPA FALLBACK MIDDLEWARES ---

let httpServer: any = null;

async function gracefulShutdown(signal: string) {
  console.log(`[Server] Received ${signal}. Starting graceful shutdown...`);
  if (httpServer) {
    httpServer.close(() => {
      console.log("[Server] HTTP server closed.");
    });
  }
  if (dbConnection.mongoClient) {
    try {
      await dbConnection.flush();
      await dbConnection.mongoClient.close();
      console.log("[Database] MongoDB connection closed gracefully.");
    } catch (err) {
      console.error("[Database] Error closing MongoDB connection:", err);
    }
  }
  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

async function startServer() {
  console.log("[Server] Initializing database connection...");
  try {
    await dbConnection.init();
    console.log("[Server] Database initialized successfully.");
  } catch (dbErr) {
    console.error("[Server] Critical database initialization failure:", dbErr);
    if (config.REQUIRE_MONGODB) {
      console.error("[Server] REQUIRE_MONGODB is true. Exiting process.");
      process.exit(1);
    }
  }

  // Full-text search + OCR
  await checkOcrTools();
  searchIndex.rebuild(dbConnection.getPapers());
  ocrQueue.onPaperDone = (id) => {
    const p = dbConnection.getPapers().find(x => x.id === id);
    if (p) searchIndex.indexPaper(p);
  };
  ocrQueue.onPaperProgress = (id) => {
    // make long theses searchable while they are still being processed
    const p = dbConnection.getPapers().find(x => x.id === id);
    if (p && (p.textPagesDone || 0) % 10 === 0) searchIndex.indexPaper(p);
  };
  ocrQueue.resume();
  dbConnection.save();
  console.log(`[AI] ${config.AI.ENABLED ? "Enabled with " + config.AI.PROVIDERS.map(p => p.name).join(", ") : "Disabled (no AI_PROVIDER_* configured)"}`);

  if (!config.isProduction) {
    // Vite is only needed in development; it is not installed in the production image
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, { index: false, maxAge: "1h" }));
    app.get("*", (req: Request, res: Response) => {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Research Archive application running on: http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Express boot compilation breakdown:", err);
  process.exit(1);
});
