// server/src/middleware/audit.js
import Bitacora from "../models/bitacoraEntry.model.js";
import { bus } from "../server.js";

export async function audit({ level="audit", modulo, accion, mensaje, req, meta }) {
  const entry = await Bitacora.create({
    level, modulo, accion, mensaje,
    usuario: req?.auth?.sub || undefined,
    origenIp: req?.ip,
    tags: [],
    meta
  });
  bus.emit("bitacora:new", entry);
}
