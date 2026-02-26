// server/modules/iam/controllers/catalogs.controller.js
import COUNTRIES_ES from "../catalogs/countries.es.js";
import ESTADOS_CIVILES from "../catalogs/civilStatus.es.js";
import PROFESIONES_OFICIOS from "../catalogs/professions.es.js";

export function getCivilStatus(req, res) {
  return res.json({ ok: true, items: ESTADOS_CIVILES });
}

export function getCountries(req, res) {
  return res.json({ ok: true, items: COUNTRIES_ES });
}

export function getProfessions(req, res) {
  return res.json({ ok: true, items: PROFESIONES_OFICIOS });
}

export function getAllCatalogs(req, res) {
  return res.json({
    ok: true,
    civilStatus: ESTADOS_CIVILES,
    countries: COUNTRIES_ES,
    professions: PROFESIONES_OFICIOS,
  });
}