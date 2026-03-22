import fs from "node:fs";
import path from "node:path";
import {
  SUPPORT_DOCS,
  SUPPORT_BASE_UPLOAD_DIR,
} from "../support.constants.js";

/* ───────────────────────── Helpers ───────────────────────── */

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function fileStatsSafe(fullPath) {
  try {
    if (!fs.existsSync(fullPath)) return null;
    const stats = fs.statSync(fullPath);
    return {
      size: stats.size,
      updatedAt: stats.mtime,
      createdAt: stats.birthtime,
    };
  } catch {
    return null;
  }
}

function getPublicUrlFromRelative(relativePath = "") {
  if (!relativePath) return null;
  return `/${String(relativePath).replace(/\\/g, "/")}`;
}

function readFolderFiles(folderPath) {
  try {
    if (!fs.existsSync(folderPath)) return [];
    return fs
      .readdirSync(folderPath, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

function guessMimeType(filename = "") {
  const ext = path.extname(filename).toLowerCase();

  if (ext === ".pdf") return "application/pdf";
  if (ext === ".doc") return "application/msword";
  if (ext === ".docx")
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === ".md") return "text/markdown";
  if (ext === ".txt") return "text/plain";

  return "application/octet-stream";
}

function resolveLatestFileForDoc(doc) {
  const folderAbs = path.resolve(
    process.cwd(),
    SUPPORT_BASE_UPLOAD_DIR,
    doc.folder
  );

  ensureDir(folderAbs);

  const files = readFolderFiles(folderAbs);
  if (!files.length) {
    return {
      exists: false,
      filename: null,
      relativePath: null,
      publicUrl: null,
      mimeType: null,
      size: 0,
      updatedAt: null,
    };
  }

  const enriched = files
    .map((filename) => {
      const fullPath = path.join(folderAbs, filename);
      const stats = fileStatsSafe(fullPath);
      return { filename, fullPath, stats };
    })
    .filter((item) => item.stats);

  if (!enriched.length) {
    return {
      exists: false,
      filename: null,
      relativePath: null,
      publicUrl: null,
      mimeType: null,
      size: 0,
      updatedAt: null,
    };
  }

  enriched.sort(
    (a, b) =>
      new Date(b.stats.updatedAt).getTime() -
      new Date(a.stats.updatedAt).getTime()
  );

  const latest = enriched[0];
  const relativePath = path.join(
    SUPPORT_BASE_UPLOAD_DIR,
    doc.folder,
    latest.filename
  );

  return {
    exists: true,
    filename: latest.filename,
    relativePath,
    publicUrl: getPublicUrlFromRelative(relativePath),
    mimeType: guessMimeType(latest.filename),
    size: latest.stats.size || 0,
    updatedAt: latest.stats.updatedAt || null,
  };
}

/* ───────────────────── Funciones públicas ───────────────────── */

export function ensureSupportFolders() {
  const baseAbs = path.resolve(process.cwd(), SUPPORT_BASE_UPLOAD_DIR);
  ensureDir(baseAbs);

  for (const doc of SUPPORT_DOCS) {
    ensureDir(path.join(baseAbs, doc.folder));
  }
}

export function listSupportDocs() {
  ensureSupportFolders();

  return SUPPORT_DOCS.map((doc) => {
    const latest = resolveLatestFileForDoc(doc);

    return {
      slug: doc.slug,
      title: doc.title,
      audience: doc.audience,
      description: doc.description,
      folder: doc.folder,
      file: latest,
      ready: latest.exists,
    };
  });
}

export function getSupportDocBySlug(slug) {
  ensureSupportFolders();

  const doc = SUPPORT_DOCS.find(
    (item) => item.slug === String(slug || "").trim()
  );
  if (!doc) return null;

  const latest = resolveLatestFileForDoc(doc);

  return {
    slug: doc.slug,
    title: doc.title,
    audience: doc.audience,
    description: doc.description,
    folder: doc.folder,
    file: latest,
    ready: latest.exists,
  };
}