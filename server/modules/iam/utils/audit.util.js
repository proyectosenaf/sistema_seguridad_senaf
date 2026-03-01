// server/modules/iam/utils/audit.util.js
import IamAudit from "../models/IamAudit.model.js";

/**
 * writeAudit(req, data)
 * - Nunca debe tumbar el proceso.
 * - Formato canónico (sin ts, sin actor:{...})
 */

const ACTION_MAP = {
  create: "create",
  update: "update",
  delete: "delete",
  activate: "activate",
  deactivate: "deactivate",

  // compat:
  enable: "activate",
  disable: "deactivate",
};

const ENTITY_SET = new Set(["user", "role", "permission"]);

function normAction(a) {
  const k = String(a || "").trim().toLowerCase();
  return ACTION_MAP[k] || "update"; // fallback seguro para enum
}

function normEntity(e) {
  const k = String(e || "").trim().toLowerCase();
  return ENTITY_SET.has(k) ? k : null;
}

export async function writeAudit(req, data = {}) {
  try {
    // Prioridad: ctx IAM (buildContextFrom) -> auth payload -> compat headers dev
    const actorEmail =
      (req?.iam?.email && String(req.iam.email).toLowerCase().trim()) ||
      (req?.auth?.payload?.email && String(req.auth.payload.email).toLowerCase().trim()) ||
      (req?.user?.email && String(req.user.email).toLowerCase().trim()) ||
      (req?.headers?.["x-user-email"] && String(req.headers["x-user-email"]).toLowerCase().trim()) ||
      "";

    const actorId =
      (req?.iam?.user?._id && String(req.iam.user._id)) ||
      (req?.auth?.payload?.sub && String(req.auth.payload.sub).trim()) ||
      (req?.user?.sub && String(req.user.sub).trim()) ||
      (req?.headers?.["x-user-id"] && String(req.headers["x-user-id"]).trim()) ||
      null;

    const ip =
      req?.headers?.["x-forwarded-for"]?.toString()?.split(",")?.[0]?.trim() ||
      req?.ip ||
      null;

    const ua = req?.headers?.["user-agent"] || null;
    const path = req?.originalUrl || req?.url || null;
    const method = req?.method || null;

    const entity = normEntity(data.entity);
    if (!entity) {
      // Si prefieres “no fallar”, cambia esto por: const entity = "user";
      return false;
    }

    const doc = {
      actorEmail,
      actorId,
      action: normAction(data.action),
      entity,
      entityId: data.entityId ? String(data.entityId) : null,
      before: data.before ?? null,
      after: data.after ?? null,
      meta: { ip, ua, path, method },
    };

    await IamAudit.create(doc);
    return true;
  } catch (e) {
    console.warn("[iam][audit] skip:", e?.message || e);
    return false;
  }
}

export default writeAudit;