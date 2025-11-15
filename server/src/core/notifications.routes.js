// server/core/notifications.routes.js
import express from "express";
import { makeNotifier } from "./notify.js";

const router = express.Router();

/**
 * Este router asume que, si hay autenticación,
 * algún middleware previo habrá puesto req.user (con .sub / .email).
 *
 * En server.js lo montas así:
 *   app.set("notifier", notifier);
 *   app.use("/api/notifications", notificationsRoutes);
 */

// ─────────── Helpers ───────────
function getNotifier(req) {
  const globalNotifier = req.app.get("notifier");
  if (globalNotifier) return globalNotifier;

  // Fallback temporal (sin io ni mailer)
  const temp = makeNotifier({});
  req.app.set("notifier", temp);
  return temp;
}

function resolveUserId(req) {
  const h = req?.headers?.["x-user-id"];
  const headerId = typeof h === "string" ? h.trim() : "";
  const userId = req?.user?.sub || headerId;
  return userId || null;
}

// ─────────── Rutas ───────────

// GET /api/notifications/count
router.get("/count", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.json({ count: 0 });

    const notifier = getNotifier(req);
    const count = await notifier.getUnreadCount(userId);
    res.json({ count });
  } catch (err) {
    console.error("[notifications/count] error:", err);
    res.status(500).json({ count: 0, error: err?.message || "error" });
  }
});

// POST /api/notifications/read-all
router.post("/read-all", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.json({ ok: true, updated: 0 });

    const notifier = getNotifier(req);
    const result = await notifier.markAllRead(userId);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[notifications/read-all] error:", err);
    res
      .status(500)
      .json({ ok: false, error: err?.message || "error" });
  }
});

export default router;
