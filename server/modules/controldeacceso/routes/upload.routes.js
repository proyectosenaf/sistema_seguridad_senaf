import express from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";

const router = express.Router();

/* ───────────────────── Carpeta de uploads ───────────────────── */

const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");
const ACCESO_DIR = path.join(UPLOADS_ROOT, "acceso");

// Crear carpeta /uploads/acceso si no existe
if (!fs.existsSync(ACCESO_DIR)) {
  fs.mkdirSync(ACCESO_DIR, { recursive: true });
}

/* ───────────────────── Configuración Multer ──────────────────── */

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, ACCESO_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const base = path.basename(file.originalname || "file", ext);
    const safeBase = String(base)
      .replace(/[^a-z0-9_-]/gi, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .toLowerCase();

    const ts = Date.now();
    const rand = Math.round(Math.random() * 1e6);

    cb(null, `${safeBase || "file"}_${ts}_${rand}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(
      new Error(
        "Tipo de archivo no permitido. Usa imágenes: jpg, jpeg, png, webp o gif."
      )
    );
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
    files: 5,
  },
});

/* ───────────────────── Helpers ───────────────────── */

function normalizeUploadedFile(file) {
  const relativePath = path.join("acceso", file.filename).replace(/\\/g, "/");
  const publicUrl = `/uploads/${relativePath}`;

  return {
    fieldname: file.fieldname,
    originalname: file.originalname,
    filename: file.filename,
    mimetype: file.mimetype,
    size: file.size,
    url: publicUrl,
    path: relativePath,
  };
}

/* ──────────────────────── Rutas de upload ────────────────────── */

/**
 * POST /api/acceso/uploads
 *
 * Espera FormData con uno o varios archivos.
 * Ejemplo:
 *
 * const fd = new FormData();
 * fd.append("file", archivo);
 *
 * fetch("/api/acceso/uploads", {
 *   method: "POST",
 *   body: fd,
 * });
 */
router.post("/", (req, res) => {
  upload.any()(req, res, (err) => {
    try {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            ok: false,
            error: "El archivo excede el tamaño máximo permitido de 5 MB.",
          });
        }

        if (err.code === "LIMIT_FILE_COUNT") {
          return res.status(400).json({
            ok: false,
            error: "Se excedió el número máximo de archivos permitidos.",
          });
        }

        return res.status(400).json({
          ok: false,
          error: err.message || "Error subiendo archivo.",
        });
      }

      if (err) {
        return res.status(400).json({
          ok: false,
          error: err.message || "Archivo inválido.",
        });
      }

      if (!req.files || !req.files.length) {
        return res.status(400).json({
          ok: false,
          error: "No se recibió ningún archivo.",
        });
      }

      const files = req.files.map(normalizeUploadedFile);

      return res.json({
        ok: true,
        file: files[0],   // compatibilidad con frontend actual
        files,            // soporte múltiple futuro
      });
    } catch (error) {
      console.error("[acceso uploads] error:", error);
      return res.status(500).json({
        ok: false,
        error: error.message || "Error subiendo archivo.",
      });
    }
  });
});

export default router;