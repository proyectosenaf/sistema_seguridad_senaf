// server/src/modules/acceso/routes/upload.routes.js
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

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, ACCESO_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const base = path.basename(file.originalname || "file", ext);
    const safeBase = base.replace(/[^a-z0-9_-]/gi, "_").toLowerCase();

    const ts = Date.now();
    const rand = Math.round(Math.random() * 1e6);
    cb(null, `${safeBase}_${ts}_${rand}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  const allowed = [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "image/webp",
    "image/gif",
  ];
  if (!allowed.includes(file.mimetype)) {
    return cb(
      new Error("Tipo de archivo no permitido. Usa imágenes (jpg, png, webp, gif).")
    );
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
});

/* ──────────────────────── Rutas de upload ────────────────────── */
/**
 * POST /api/acceso/uploads
 * (montado en server.js)
 *
 * Espera un FormData con al menos UN archivo en cualquier campo.
 * Ejemplo en el cliente:
 *
 * const fd = new FormData();
 * fd.append("file", archivo); // o "foto", etc.
 *
 * fetch("/api/acceso/uploads", { method: "POST", body: fd });
 */
router.post("/", upload.any(), (req, res) => {
  try {
    if (!req.files || !req.files.length) {
      return res
        .status(400)
        .json({ ok: false, error: "No se recibió ningún archivo" });
    }

    // Tomamos el primer archivo (puedes ajustar si necesitas varios)
    const file = req.files[0];

    // URL pública (recuerda que en server.js tienes app.use("/uploads", ...))
    const relativePath = path.join("acceso", file.filename).replace(/\\/g, "/");
    const publicUrl = `/uploads/${relativePath}`;

    return res.json({
      ok: true,
      file: {
        fieldname: file.fieldname,
        originalname: file.originalname,
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
        url: publicUrl,
        path: relativePath,
      },
    });
  } catch (err) {
    console.error("[acceso uploads] error:", err);
    return res
      .status(500)
      .json({ ok: false, error: err.message || "Error subiendo archivo" });
  }
});

export default router;
