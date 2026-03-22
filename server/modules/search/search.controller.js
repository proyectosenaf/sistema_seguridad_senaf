import { runGlobalSearch } from "./search.service.js";

export async function globalSearchController(req, res) {
  try {
    const q = String(req.query.q || "").trim();

    if (!q) {
      return res.json({
        ok: true,
        results: [],
      });
    }

    const user = req.user || req.auth || req.me || null;

    const results = await runGlobalSearch({
      q,
      user,
      limit: 12,
    });

    return res.json({
      ok: true,
      results,
    });
  } catch (err) {
    console.error("[search.global] error:", err);
    return res.status(500).json({
      ok: false,
      message: "No se pudo ejecutar la búsqueda global.",
      results: [],
    });
  }
}