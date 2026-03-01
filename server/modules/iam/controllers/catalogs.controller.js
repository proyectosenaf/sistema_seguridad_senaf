// server/modules/iam/controllers/catalogs.controller.js
import COUNTRIES_ES from "../catalogs/countries.es.js";
import ESTADOS_CIVILES from "../catalogs/civilStatus.es.js";
import PROFESIONES_OFICIOS from "../catalogs/professions.es.js";

function noStore(res) {
  // evita caché raro en proxies/navegador
  res.setHeader("Cache-Control", "no-store");
}

export function getCivilStatus(_req, res) {
  noStore(res);
  return res.json({ ok: true, items: ESTADOS_CIVILES });
}

export function getCountries(_req, res) {
  noStore(res);
  return res.json({ ok: true, items: COUNTRIES_ES });
}

export function getProfessions(_req, res) {
  noStore(res);
  return res.json({ ok: true, items: PROFESIONES_OFICIOS });
}

export function getAllCatalogs(_req, res) {
  noStore(res);
  return res.json({
    ok: true,
    items: {
      civilStatus: ESTADOS_CIVILES,
      countries: COUNTRIES_ES,
      professions: PROFESIONES_OFICIOS,
    },
  });
}