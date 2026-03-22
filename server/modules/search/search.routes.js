// server/modules/search/search.routes.js
import express from "express";
import { globalSearch } from "./search.service.js";

const router = express.Router();

router.get("/global", async (req, res) => {
  try {
    const q = String(req.query.q || "");
    const user = req.iam || req.user || req.authUser || null;

    const results = await globalSearch({ q, user });

    res.json({ ok: true, results });
  } catch (err) {
    console.error("[search] error:", err);
    res.status(500).json({
      ok: false,
      error: "search_error",
      results: [],
    });
  }
});

export default router;