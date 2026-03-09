// server/modules/iam/routes/catalogs.routes.js
import { Router } from "express";
import {
  getCivilStatus,
  getCountries,
  getProfessions,
  getAllCatalogs,
} from "../controllers/catalogs.controller.js";

import {
  listCatalogPermissions,
  syncPermissionsCatalog,
} from "../services/permissions.sync.service.js";

const r = Router();

/**
 * Público o protegido: tu decides.
 * Si querés protegerlo con tu RBAC, aquí es donde meterías requireAuth/requirePerm.
 */

/* ==================================================
   CATÁLOGOS EXISTENTES
   ================================================== */

/* =========================
 * Español (para tu frontend)
 * ========================= */
r.get("/estado-civil", getCivilStatus);
r.get("/paises", getCountries);
r.get("/profesiones", getProfessions);
r.get("/todos", getAllCatalogs);

/* =========================
 * Inglés (compatibilidad)
 * ========================= */
r.get("/civil-status", getCivilStatus);
r.get("/countries", getCountries);
r.get("/professions", getProfessions);
r.get("/all", getAllCatalogs);

/* ==================================================
   NUEVO: CATÁLOGO DE PERMISOS
   ================================================== */

/**
 * Devuelve el catálogo de permisos definido en código
 * (no depende de la base de datos)
 */
r.get("/permissions", (req, res) => {
  try {
    const items = listCatalogPermissions();
    return res.json({ ok: true, items });
  } catch (err) {
    console.error("[catalogs.permissions] error:", err);
    return res.status(500).json({
      ok: false,
      error: "Error obteniendo catálogo de permisos",
    });
  }
});

/**
 * Sincroniza catálogo -> MongoDB
 * Crea permisos faltantes y actualiza labels/grupos
 */
r.post("/permissions/sync", async (req, res) => {
  try {
    const result = await syncPermissionsCatalog();
    return res.json({
      ok: true,
      result,
    });
  } catch (err) {
    console.error("[catalogs.permissions.sync] error:", err);
    return res.status(500).json({
      ok: false,
      error: "Error sincronizando permisos",
    });
  }
});

export default r;