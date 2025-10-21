import IamAudit from "../models/IamAudit.model.js";

export async function writeAudit(req, {
  action,        // "create" | "update" | "deactivate" | "activate" | "delete"
  entity,        // "user" | "role" | "permission"
  entityId,
  before = null,
  after = null,
} = {}) {
  try {
    const actorId    = req.user?._id || req.user?.id || null;
    const actorEmail = req.user?.email || req.headers["x-user-email"] || "unknown@local";

    await IamAudit.create({
      action,
      entity,
      entityId,
      actorId,
      actorEmail,
      before,
      after,
    });
  } catch (e) {
    console.warn("[AUDIT] no se pudo registrar:", e?.message || e);
  }
}
