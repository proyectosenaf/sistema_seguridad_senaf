import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import {
  getBackupBaseDir,
  buildBackupName,
} from "../utils/backupPaths.js";

function makeError(message, status = 500) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function assertSafeFileName(name) {
  const value = String(name || "").trim();

  if (
    !value ||
    value.includes("..") ||
    value.includes("/") ||
    value.includes("\\")
  ) {
    throw makeError("Nombre de respaldo inválido.", 400);
  }

  return value;
}

function ensureBackupDir() {
  const baseDir = getBackupBaseDir();

  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  return baseDir;
}

function isBackupRestoreEnabled() {
  return (
    String(process.env.ENABLE_BACKUP_RESTORE || "")
      .trim()
      .toLowerCase() === "true"
  );
}

function getMongoUri() {
  const uri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    process.env.MONGO_URL ||
    "";

  if (!uri) {
    throw makeError(
      "No se encontró la URI de MongoDB en las variables de entorno.",
      500
    );
  }

  return String(uri).trim();
}

function getMongodumpBin() {
  return String(process.env.MONGODUMP_BIN || "mongodump").trim();
}

function getMongorestoreBin() {
  return String(process.env.MONGORESTORE_BIN || "mongorestore").trim();
}

function assertBinaryExists(binPath, label) {
  if (!binPath) {
    throw makeError(`No se configuró la ruta de ${label}.`, 500);
  }

  const looksLikePath =
    binPath.includes("/") || binPath.includes("\\") || binPath.startsWith(".");

  if (looksLikePath && !fs.existsSync(binPath)) {
    throw makeError(
      `No se encontró el ejecutable de ${label} en la ruta: ${binPath}`,
      500
    );
  }
}

function sanitizeToolOutput(text = "") {
  const raw = String(text || "").trim();
  if (!raw) return "";

  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const filtered = lines.filter((line) => {
    const lower = line.toLowerCase();

    if (
      lower.includes("warning: on some systems, a password provided directly") ||
      lower.includes("consider omitting the password to provide it via stdin") ||
      lower.includes("using the --config option to specify a configuration file")
    ) {
      return false;
    }

    return true;
  });

  return filtered.join("\n").trim();
}

function buildFriendlyCommandError(command, code, stdout, stderr) {
  const cleanedStdout = sanitizeToolOutput(stdout);
  const cleanedStderr = sanitizeToolOutput(stderr);
  const details = cleanedStderr || cleanedStdout;

  if (details) {
    return makeError(`Falló la ejecución de ${command}. ${details}`, 500);
  }

  return makeError(
    `El comando ${command} terminó con código ${code}.`,
    500
  );
}

function runCommand(command, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (err) => {
      reject(
        makeError(
          `No se pudo ejecutar el comando ${command}: ${err.message}`,
          500
        )
      );
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({
          stdout: sanitizeToolOutput(stdout),
          stderr: sanitizeToolOutput(stderr),
        });
        return;
      }

      reject(buildFriendlyCommandError(command, code, stdout, stderr));
    });
  });
}

export async function createBackup() {
  if (!isBackupRestoreEnabled()) {
    throw makeError(
      "La creación de respaldos automáticos con mongodump ha sido deshabilitada en este entorno.",
      501
    );
  }

  const mongoUri = getMongoUri();
  const baseDir = ensureBackupDir();
  const mongodumpBin = getMongodumpBin();

  assertBinaryExists(mongodumpBin, "mongodump");

  const name = buildBackupName("senaf-backup");
  const fullPath = path.join(baseDir, name);

  await runCommand(mongodumpBin, [
    `--uri=${mongoUri}`,
    `--archive=${fullPath}`,
    "--gzip",
  ]);

  if (!fs.existsSync(fullPath)) {
    throw makeError(
      "El respaldo no fue generado correctamente porque no se creó el archivo de salida.",
      500
    );
  }

  const stats = fs.statSync(fullPath);

  return {
    name,
    path: fullPath,
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
  const safeName = assertSafeFileName(name);
  const baseDir = ensureBackupDir();
  const fullPath = path.join(baseDir, safeName);

  if (!fs.existsSync(fullPath)) {
    throw makeError("Respaldo no encontrado.", 404);
  }

  return fullPath;
}

export async function restoreBackup(name) {
  if (!isBackupRestoreEnabled()) {
    throw makeError(
      "La restauración automática con mongorestore ha sido deshabilitada en este entorno.",
      501
    );
  }

  const safeName = assertSafeFileName(name);
  const mongoUri = getMongoUri();
  const filePath = getBackupFilePath(safeName);
  const mongorestoreBin = getMongorestoreBin();

  assertBinaryExists(mongorestoreBin, "mongorestore");

  await runCommand(mongorestoreBin, [
    `--uri=${mongoUri}`,
    `--archive=${filePath}`,
    "--gzip",
    "--drop",
  ]);

  return {
    restored: true,
    name: safeName,
    restoredAt: new Date().toISOString(),
  };
}

export function deleteBackup(name) {
  const safeName = assertSafeFileName(name);
  const filePath = getBackupFilePath(safeName);

  fs.unlinkSync(filePath);

  return {
    deleted: true,
    name: safeName,
    deletedAt: new Date().toISOString(),
  };
}

export function getBackupDownloadMeta(name) {
  const safeName = assertSafeFileName(name);
  const filePath = getBackupFilePath(safeName);
  const stats = fs.statSync(filePath);

  return {
    filePath,
    size: stats.size,
    name: safeName,
  };
}

export function cleanupOldBackups() {
  const baseDir = ensureBackupDir();
  const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS || 30);
  const now = Date.now();
  const removed = [];

  const files = fs.readdirSync(baseDir, { withFileTypes: true });

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