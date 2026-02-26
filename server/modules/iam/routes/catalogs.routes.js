// server/modules/iam/routes/catalogs.routes.js
import { Router } from "express";
import {
  getCivilStatus,
  getCountries,
  getProfessions,
  getAllCatalogs,
} from "../controllers/catalogs.controller.js";

const r = Router();

/**
 * Público o protegido: tu decides.
 * Si querés protegerlo con tu RBAC, aquí es donde meterías requireAuth/requirePerm.
 */

// individuales
r.get("/civil-status", getCivilStatus);
r.get("/countries", getCountries);
r.get("/professions", getProfessions);

// todo junto
r.get("/all", getAllCatalogs);

export default r;