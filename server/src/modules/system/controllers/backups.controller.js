import crypto from "node:crypto";
import * as backupsService from "../services/backups.service.js";
import BitacoraEvent from "../../../../modules/bitacora/models/BitacoraEvent.model.js";

function getActor(req) {
  return (
    req.user?.email ||
    req.user?.username ||
    req.user?.sub ||
    "system"
  );
}

function getActorRole(req) {
  const rawRoles =
    req.user?.roles ||
    req.auth?.roles ||
    req.iam?.roles ||
    [];

  if (Array.isArray(rawRoles) && rawRoles.length > 0) {
    return String(rawRoles[0] || "").trim();
  }

  if (typeof rawRoles === "string") {
    return rawRoles.trim();
  }

  return "";
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || "";
}

function getShiftLabel(date = new Date()) {
  const hour = new Date(date).getHours();
  if (hour >= 6 && hour < 12) return "Mañana";
  if (hour >= 12 && hour < 18) return "Tarde";
  return "Noche";
}

function buildEventKey(action, backupName = "") {
  const seed = `${action}::${backupName}::${Date.now()}::${Math.random()}`;
  const suffix = crypto.createHash("sha1").update(seed).digest("hex").slice(0, 16);
  return `system.backups.${action}.${suffix}`;
}

async function writeBackupBitacora(
  req,
  { action, title, description, backupName = "", meta = {} }
) {
  const now = new Date();

  await BitacoraEvent.create({
    eventKey: buildEventKey(action, backupName),
    fecha: now,
    modulo: "General",
    tipo: "Evento",
    accion: action,
    entidad: "backup",
    entidadId: String(backupName || ""),
    agente: getActor(req) || "Sistema",
    actorId: String(req.user?._id || req.user?.id || req.user?.sub || ""),
    actorEmail: String(req.user?.email || ""),
    actorRol: getActorRole(req),
    nombre: String(backupName || ""),
    empresa: "",
    turno: getShiftLabel(now),
    titulo: title,
    descripcion: description,
    prioridad: action === "RESTORE" ? "Crítica" : "Media",
    estado: "Registrado",
    source: "backend",
    ip: getClientIp(req),
    userAgent: String(req.headers["user-agent"] || ""),
    visible: true,
    archived: false,
    before: null,
    after: null,
    meta,
  });
}

export async function createBackupHandler(req, res) {
  try {
    const result = await backupsService.createBackup();

    await writeBackupBitacora(req, {
      action: "CREATE",
      title: "Respaldo generado",
      description: `Se generó el respaldo ${result.name}.`,
      backupName: result.name,
      meta: {
        backupName: result.name,
        size: result.size,
        createdAt: result.createdAt,
        path: result.path,
      },
    });

    return res.json({
      ok: true,
      message: "Respaldo generado correctamente.",
      data: result,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      ok: false,
      message: error.message || "No se pudo generar el respaldo.",
    });
  }
}

export async function listBackupsHandler(req, res) {
  try {
    const data = backupsService.listBackups();

    return res.json({
      ok: true,
      data,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      ok: false,
      message: error.message || "No se pudieron listar los respaldos.",
    });
  }
}

export async function restoreBackupHandler(req, res) {
  try {
    const { name } = req.body || {};
    const result = await backupsService.restoreBackup(name);

    await writeBackupBitacora(req, {
      action: "RESTORE",
      title: "Respaldo restaurado",
      description: `Se restauró el respaldo ${name}.`,
      backupName: name,
      meta: {
        backupName: name,
        restoredAt: result.restoredAt,
      },
    });

    return res.json({
      ok: true,
      message: "Respaldo restaurado correctamente.",
      data: result,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      ok: false,
      message: error.message || "No se pudo restaurar el respaldo.",
    });
  }
}

export async function deleteBackupHandler(req, res) {
  try {
    const { name } = req.params;
    const result = backupsService.deleteBackup(name);

    await writeBackupBitacora(req, {
      action: "DELETE",
      title: "Respaldo eliminado",
      description: `Se eliminó el respaldo ${name}.`,
      backupName: name,
      meta: {
        backupName: name,
        deletedAt: result.deletedAt,
      },
    });

    return res.json({
      ok: true,
      message: "Respaldo eliminado correctamente.",
      data: result,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      ok: false,
      message: error.message || "No se pudo eliminar el respaldo.",
    });
  }
}

export async function downloadBackupHandler(req, res) {
  try {
    const { name } = req.params;
    const { filePath } = backupsService.getBackupDownloadMeta(name);

    return res.download(filePath, name);
  } catch (error) {
    return res.status(error.status || 500).json({
      ok: false,
      message: error.message || "No se pudo descargar el respaldo.",
    });
  }
}