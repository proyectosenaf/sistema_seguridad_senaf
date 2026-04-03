import fs from "fs";
import path from "path";
import { getBackupBaseDir } from "../utils/backupPaths.js";

function assertSafeFileName(name) {
  if (
    !name ||
    typeof name !== "string" ||
    name.includes("..") ||
    name.includes("/") ||
    name.includes("\\")
  ) {
    const error = new Error("Nombre de respaldo inválido.");
    error.status = 400;
    throw error;
  }
}

function ensureBackupDir() {
  const baseDir = getBackupBaseDir();

  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  return baseDir;
}

export async function createBackup() {
  const error = new Error(
    "La creación de respaldos automáticos con mongodump ha sido deshabilitada en este entorno."
  );
  error.status = 501;
  throw error;
}

export function listBackups() {
  const baseDir = ensureBackupDir();
  const files = fs.readdirSync(baseDir, { withFileTypes: true });

  return files
    .filter((entry) => entry.isFile() && entry.name.endsWith(".gz"))
    .map((entry) => {
      const fullPath = path.join(baseDir, entry.name);
      const stats = fs.statSync(fullPath);

      return {
        name: entry.name,
        size: stats.size,
        createdAt: stats.birthtime || stats.mtime,
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function getBackupFilePath(name) {
  assertSafeFileName(name);

  const baseDir = ensureBackupDir();
  const fullPath = path.join(baseDir, name);

  if (!fs.existsSync(fullPath)) {
    const error = new Error("Respaldo no encontrado.");
    error.status = 404;
    throw error;
  }

  return fullPath;
}

export async function restoreBackup() {
  const error = new Error(
    "La restauración automática con mongorestore ha sido deshabilitada en este entorno."
  );
  error.status = 501;
  throw error;
}

export function deleteBackup(name) {
  const filePath = getBackupFilePath(name);
  fs.unlinkSync(filePath);

  return {
    deleted: true,
    name,
    deletedAt: new Date().toISOString(),
  };
}

export function getBackupDownloadMeta(name) {
  const filePath = getBackupFilePath(name);
  const stats = fs.statSync(filePath);

  return {
    filePath,
    size: stats.size,
    name,
  };
}

export function cleanupOldBackups() {
  const baseDir = ensureBackupDir();
  const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS || 30);
  const now = Date.now();

  const files = fs.readdirSync(baseDir, { withFileTypes: true });
  const removed = [];

  for (const entry of files) {
    if (!entry.isFile() || !entry.name.endsWith(".gz")) continue;

    const fullPath = path.join(baseDir, entry.name);
    const stats = fs.statSync(fullPath);

    const ageDays =
      (now - new Date(stats.mtime).getTime()) / (1000 * 60 * 60 * 24);

    if (ageDays > retentionDays) {
      fs.unlinkSync(fullPath);
      removed.push(entry.name);
    }
  }

  return removed;
}