// server/modules/iam/controllers/catalogs.controller.js
import COUNTRIES_ES from "../catalogs/countries.es.js";
import ESTADOS_CIVILES from "../catalogs/civilStatus.es.js";
import PROFESIONES_OFICIOS from "../catalogs/professions.es.js";

function noStore(res) {
  // evita caché raro en proxies/navegador
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

export function getCivilStatus(_req, res) {
  noStore(res);
  return res.json({
    ok: true,
    items: safeArray(ESTADOS_CIVILES),
  });
}

export function getCountries(_req, res) {
  noStore(res);
  return res.json({
    ok: true,
    items: safeArray(COUNTRIES_ES),
  });
}

export function getProfessions(_req, res) {
  noStore(res);
  return res.json({
    ok: true,
    items: safeArray(PROFESIONES_OFICIOS),
  });
}

export function getAllCatalogs(_req, res) {
  noStore(res);

  const civilStatus = safeArray(ESTADOS_CIVILES);
  const countries = safeArray(COUNTRIES_ES);
  const professions = safeArray(PROFESIONES_OFICIOS);

  return res.json({
    ok: true,
    items: {
      civilStatus,
      countries,
      professions,

      // compatibilidad con frontend que busca otros nombres
      estadosCiviles: civilStatus,
      paises: countries,
      profesiones: professions,
    },
  });
}