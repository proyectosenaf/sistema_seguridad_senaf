import Audit from "../models/Audit.js";

function actorFromReq(req){
  return {
    id:    req.headers["x-user-id"] || req.user?._id?.toString(),
    email: req.headers["x-user-email"] || req.user?.email,
    roles: (req.headers["x-user-roles"]?.split(",") || req.user?.roles || []).filter(Boolean),
    ip:    req.ip
  };
}
function sanitize(obj){
  if (!obj) return obj;
  const clone = JSON.parse(JSON.stringify(obj));
  delete clone?.password;
  delete clone?.hash;
  delete clone?.__v;
  return clone;
}

export async function recordAudit({ req, entityType, entityId, action, before, after, meta }){
  try{
    await Audit.create({
      ts: new Date(),
      action,
      entity: { type: entityType, id: entityId?.toString?.() || entityId },
      actor: actorFromReq(req),
      before: sanitize(before),
      after:  sanitize(after),
      meta
    });
  }catch(e){
    console.error("[audit]", e.message);
  }
}

export const auditUser =  (args) => recordAudit({ ...args, entityType:"user" });
export const auditRole =  (args) => recordAudit({ ...args, entityType:"role" });
export const auditPerm =  (args) => recordAudit({ ...args, entityType:"permission" });
