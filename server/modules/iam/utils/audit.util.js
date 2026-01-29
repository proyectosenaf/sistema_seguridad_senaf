// server/modules/iam/utils/audit.util.js
import IamAudit from "../models/IamAudit.model.js";

/**
 * writeAudit(req, data)
 * - No debe romper el servidor si falla la auditoría.
 * - Guarda: actor/email, acción, entidad, before/after, ip, ua, ts
 */
export async function writeAudit(req, data = {}) {
  try {
    const actorEmail =
      req?.user?.email ||
      req?.auth?.payload?.email ||
      req?.headers?.["x-user-email"] ||
      null;

    const actorSub =
      req?.user?.sub ||
      req?.auth?.payload?.sub ||
      req?.headers?.["x-user-id"] ||
      null;

    const doc = {
      ts: new Date(),
      actor: {
        email: actorEmail,
        sub: actorSub,
      },
      action: data.action || "unknown",
      entity: data.entity || "unknown",
      entityId: data.entityId || null,
      before: data.before ?? null,
      after: data.after ?? null,
      meta: {
        ip:
          req?.headers?.["x-forwarded-for"]?.toString()?.split(",")?.[0]?.trim() ||
          req?.ip ||
          null,
        ua: req?.headers?.["user-agent"] || null,
        path: req?.originalUrl || req?.url || null,
        method: req?.method || null,
      },
    };

    // Si el modelo existe, guardamos. Si no, cae al catch de import/model.
    await IamAudit.create(doc);

    return true;
  } catch (e) {
    // IMPORTANT: auditoría nunca debe tumbar el proceso
    console.warn("[iam][audit] skip:", e?.message || e);
    return false;
  }
}
