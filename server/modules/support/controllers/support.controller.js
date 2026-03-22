import {
  listSupportDocs,
  getSupportDocBySlug,
} from "../services/support.service.js";

export function listDocsController(_req, res) {
  const docs = listSupportDocs();

  return res.json({
    ok: true,
    docs,
  });
}

export function getDocController(req, res) {
  const { slug } = req.params;
  const doc = getSupportDocBySlug(slug);

  if (!doc) {
    return res.status(404).json({
      ok: false,
      error: "Documento de soporte no encontrado.",
    });
  }

  return res.json({
    ok: true,
    doc,
  });
}