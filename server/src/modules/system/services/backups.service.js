import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { getBackupBaseDir, buildBackupName } from "../utils/backupPaths.js";

const execAsync = promisify(exec);

function getMongoTools() {
  return {
    mongodump: process.env.MONGODUMP_BIN || "mongodump",
    mongorestore: process.env.MONGORESTORE_BIN || "mongorestore",
  };
}

function getMongoUri() {
  return process.env.MONGO_URI || process.env.MONGODB_URI || "";
}

function assertMongoUri() {
  if (!getMongoUri()) {
    const error = new Error("MONGO_URI/MONGODB_URI no está configurada.");
    error.status = 500;
    throw error;
  }
}

function assertRestoreEnabled() {
  if (String(process.env.ENABLE_BACKUP_RESTORE).toLowerCase() !== "true") {
    const error = new Error("La restauración está deshabilitada en este entorno.");
    error.status = 403;
    throw error;
  }
}

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
  assertMongoUri();

  const mongoUri = getMongoUri();
  const { mongodump } = getMongoTools();
  const baseDir = ensureBackupDir();
  const backupName = `${buildBackupName()}.gz`;
  const archivePath = path.join(baseDir, backupName);

  const command = `"${mongodump}" --uri="${mongoUri}" --archive="${archivePath}" --gzip`;

  await execAsync(command);

  const stats = fs.statSync(archivePath);

  return {
    name: backupName,
    path: archivePath,
    size: stats.size,
    createdAt: stats.birthtime || stats.mtime,
  };
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

export async function restoreBackup(name) {
  assertRestoreEnabled();
  assertMongoUri();
  assertSafeFileName(name);

  const mongoUri = getMongoUri();
  const { mongorestore } = getMongoTools();
  const filePath = getBackupFilePath(name);

  const command = `"${mongorestore}" --uri="${mongoUri}" --archive="${filePath}" --gzip --drop`;

  await execAsync(command);

  return {
    restored: true,
    name,
    restoredAt: new Date().toISOString(),
  };
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