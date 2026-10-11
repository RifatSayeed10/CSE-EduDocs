// Where uploaded files (PDFs, images) are kept.
//  FILE_STORAGE=local  (default) -> files stay in UPLOAD_DIR on the server's disk
//  FILE_STORAGE=mongo            -> files are stored inside MongoDB (GridFS bucket "uploads").
//                                   Use this on hosts whose disk is wiped on restart
//                                   (Render free, Railway without a volume, ...).
// In mongo mode the local UPLOAD_DIR is only a temporary cache.

import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { GridFSBucket } from "mongodb";
import { config } from "./server-config";
import { dbConnection } from "./server-db";

// Resolve a "/uploads/<name>" URL to a file inside UPLOAD_DIR (never outside it)
export function resolveUploadPath(fileUrl: string | undefined): string | null {
  if (!fileUrl || !fileUrl.startsWith("/uploads/")) return null;
  const name = path.basename(fileUrl.slice("/uploads/".length));
  if (!name || name.startsWith(".")) return null;
  const full = path.resolve(config.UPLOAD_DIR, name);
  if (!full.startsWith(path.resolve(config.UPLOAD_DIR) + path.sep)) return null;
  return full;
}

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export function contentTypeFor(name: string): string {
  return MIME[path.extname(name).toLowerCase()] || "application/octet-stream";
}

function bucket(): GridFSBucket | null {
  if (config.FILE_STORAGE !== "mongo" || !dbConnection.isMongo || !dbConnection.mongoDb) return null;
  return new GridFSBucket(dbConnection.mongoDb, { bucketName: "uploads" });
}

export function storageMode(): "local" | "mongo" {
  return bucket() ? "mongo" : "local";
}

// Called right after multer saved a file in UPLOAD_DIR
export async function persistUpload(fileName: string): Promise<void> {
  const b = bucket();
  if (!b) return; // local mode: the file already is where it belongs
  const localPath = path.join(config.UPLOAD_DIR, fileName);
  await new Promise<void>((resolve, reject) => {
    const up = b.openUploadStream(fileName, { metadata: { contentType: contentTypeFor(fileName) } });
    fs.createReadStream(localPath).on("error", reject).pipe(up).on("error", reject).on("finish", () => resolve());
  });
  // keep the local copy as a cache; it disappears on its own when the host wipes the disk
}

// Open an uploaded file for reading ("/uploads/<name>" URL). null if it doesn't exist.
export async function openUpload(fileUrl: string | undefined): Promise<{ stream: Readable; size: number; contentType: string } | null> {
  const localPath = resolveUploadPath(fileUrl);
  if (!localPath) return null;
  const name = path.basename(localPath);
  if (fs.existsSync(localPath)) {
    return { stream: fs.createReadStream(localPath), size: fs.statSync(localPath).size, contentType: contentTypeFor(name) };
  }
  const b = bucket();
  if (!b) return null;
  const files = await b.find({ filename: name }).sort({ uploadDate: -1 }).limit(1).toArray();
  if (!files.length) return null;
  return { stream: b.openDownloadStream(files[0]._id), size: files[0].length, contentType: contentTypeFor(name) };
}

// Make sure a local copy exists (for tools that need a real file, e.g. PDF text extraction)
export async function ensureLocalCopy(fileUrl: string | undefined): Promise<string | null> {
  const localPath = resolveUploadPath(fileUrl);
  if (!localPath) return null;
  if (fs.existsSync(localPath)) return localPath;
  const f = await openUpload(fileUrl);
  if (!f) return null;
  const tmp = localPath + ".part";
  await new Promise<void>((resolve, reject) => {
    f.stream.on("error", reject).pipe(fs.createWriteStream(tmp)).on("error", reject).on("finish", () => resolve());
  });
  fs.renameSync(tmp, localPath);
  return localPath;
}

export async function deleteUpload(fileUrl: string | undefined): Promise<void> {
  const localPath = resolveUploadPath(fileUrl);
  if (!localPath) return;
  try {
    if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
  } catch (e) {
    console.warn("Could not delete uploaded file:", e);
  }
  const b = bucket();
  if (!b) return;
  try {
    const files = await b.find({ filename: path.basename(localPath) }).toArray();
    for (const f of files) await b.delete(f._id);
  } catch (e) {
    console.warn("Could not delete file from MongoDB:", e);
  }
}

// Total size of files stored in MongoDB (MB), for the health page
export async function mongoStorageUsedMb(): Promise<number | null> {
  if (!bucket() || !dbConnection.mongoDb) return null;
  const r = await dbConnection.mongoDb.collection("uploads.files")
    .aggregate([{ $group: { _id: null, total: { $sum: "$length" } } }]).toArray();
  return Math.round(((r[0]?.total || 0) / (1024 * 1024)) * 10) / 10;
}
