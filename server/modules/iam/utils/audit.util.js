// server/modules/iam/utils/audit.util.js
import IamAudit from "../models/IamAudit.model.js";

const ACTION_MAP = {
  create: "create",
  update: "update",
  delete: "delete",
  activate: "activate",
  deactivate: "deactivate",
  enable: "activate",
  disable: "deactivate",
};

const ENTITY_SET = new Set(["user", "role", "permission"]);

function normAction(a) {
  const k = String(a || "").trim().toLowerCase();
  return ACTION_MAP[k] || "update";
}

function normEntity(e) {
  const k = String(e || "").trim().toLowerCase();
  return ENTITY_SET.has(k) ? k : null;
}

function safeStr(v) {
  if (v === undefined || v === null) return "";
  return String(v);
}

function firstForwardedIp(xff) {
  if (!xff) return null;
  try {
    const s = Array.isArray(xff) ? xff.join(",") : String(xff);
    const first = s.split(",")[0]?.trim();
    return first || null;
  } catch {
    return null;
  }
}

export async function writeAudit(req, data = {}) {
  try {
    const actorEmail =
      (req?.iam?.email && safeStr(req.iam.email).toLowerCase().trim()) ||
      (req?.auth?.payload?.email && safeStr(req.auth.payload.email).toLowerCase().trim()) ||
      (req?.user?.email && safeStr(req.user.email).toLowerCase().trim()) ||
      (req?.headers?.["x-user-email"] &&
        safeStr(req.headers["x-user-email"]).toLowerCase().trim()) ||
      "";

    const actorId =
      (req?.iam?.user?._id && safeStr(req.iam.user._id)) ||
      (req?.auth?.payload?.sub && safeStr(req.auth.payload.sub).trim()) ||
      (req?.user?.sub && safeStr(req.user.sub).trim()) ||
      (req?.headers?.["x-user-id"] && safeStr(req.headers["x-user-id"]).trim()) ||
      null;

    const ip =
      firstForwardedIp(req?.headers?.["x-forwarded-for"]) ||
      (req?.ip ? safeStr(req.ip) : null) ||
      null;

    const ua = req?.headers?.["user-agent"] ? safeStr(req.headers["user-agent"]) : null;
    const path = req?.originalUrl || req?.url ? safeStr(req.originalUrl || req.url) : null;
    const method = req?.method ? safeStr(req.method) : null;

    const entity = normEntity(data.entity);
    if (!entity) return false;

    const doc = {
      actorEmail,
      actorId,
      action: normAction(data.action),
      entity,
      entityId: data.entityId != null ? safeStr(data.entityId) : null,
      before: data.before ?? null,
      after: data.after ?? null,
      meta: { ip, ua, path, method },
    };

    // si el modelo no está, NO tumbar request
    if (!IamAudit || typeof IamAudit.create !== "function") return false;

    await IamAudit.create(doc);
    return true;
  } catch (e) {
    console.warn("[iam][audit] skip:", e?.message || e);
    return false;
  }
}

export default writeAudit;