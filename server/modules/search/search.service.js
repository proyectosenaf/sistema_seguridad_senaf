// server/modules/search/search.service.js

import Visita from "../visitas/visitas.model.js";
import IamUser from "../iam/models/IamUser.model.js";
import BitacoraEvent from "../bitacora/models/BitacoraEvent.model.js";

import RqIncident from "../rondasqr/models/RqIncident.model.js";
import RqSite from "../rondasqr/models/RqSite.model.js";
import RqAssignment from "../rondasqr/models/RqAssignment.model.js";

import Notification from "../../src/core/models/Notification.model.js";

/* =========================================================
   Helpers
========================================================= */

function escapeRegex(text) {
  return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildRegex(q) {
  return new RegExp(escapeRegex(q), "i");
}

function canSearchModule(user, moduleKey) {
  if (!user) return false;

  if (user.superadmin) return true;

  const roles = Array.isArray(user.roles) ? user.roles : [];
  if (roles.includes("admin")) return true;

  const perms = Array.isArray(user.perms) ? user.perms : [];
  return perms.includes(moduleKey);
}

/* =========================================================
   Búsqueda Global
========================================================= */

export async function globalSearch({ q, user }) {
  if (!q || String(q).trim().length < 2) {
    return [];
  }

  const regex = buildRegex(q);
  const results = [];

  /* =========================
     USUARIOS (IAM)
  ========================= */
  if (canSearchModule(user, "iam")) {
    const users = await IamUser.find({
      $or: [{ name: regex }, { email: regex }],
    })
      .limit(5)
      .lean();

    results.push(
      ...users.map((u) => ({
        id: `user-${u._id}`,
        type: "entity",
        title: u.name || u.email,
        description: `Usuario · ${u.email}`,
        section: "Usuarios",
        path: "/iam",
      }))
    );
  }

  /* =========================
     VISITAS
  ========================= */
  if (canSearchModule(user, "visitas")) {
    const visitas = await Visita.find({
      $or: [
        { nombre: regex },
        { documento: regex },
        { empresa: regex },
        { motivo: regex },
      ],
    })
      .limit(5)
      .lean();

    results.push(
      ...visitas.map((v) => ({
        id: `visita-${v._id}`,
        type: "entity",
        title: v.nombre,
        description: `Visita · ${v.documento} · ${v.estado}`,
        section: "Control de Visitas",
        path: "/visitas",
      }))
    );
  }

  /* =========================
     BITÁCORA
  ========================= */
  if (canSearchModule(user, "bitacora")) {
    const eventos = await BitacoraEvent.find({
      $or: [
        { titulo: regex },
        { descripcion: regex },
        { nombre: regex },
        { empresa: regex },
      ],
    })
      .limit(5)
      .lean();

    results.push(
      ...eventos.map((e) => ({
        id: `bitacora-${e._id}`,
        type: "entity",
        title: e.titulo || e.tipo,
        description: `Bitácora · ${e.modulo} · ${e.accion}`,
        section: "Bitácora",
        path: "/bitacora",
      }))
    );
  }

  /* =========================
     INCIDENTES
  ========================= */
  if (canSearchModule(user, "incidentes")) {
    const incidents = await RqIncident.find({
      $or: [
        { text: regex },
        { guardName: regex },
        { officerName: regex },
        { siteName: regex },
        { roundName: regex },
      ],
    })
      .limit(5)
      .lean();

    results.push(
      ...incidents.map((i) => ({
        id: `incident-${i._id}`,
        type: "entity",
        title: i.type || "Incidente",
        description: `Incidente · ${i.siteName} · ${i.guardName}`,
        section: "Incidentes",
        path: "/incidentes",
      }))
    );
  }

  /* =========================
     SITIOS
  ========================= */
  if (canSearchModule(user, "rondas")) {
    const sites = await RqSite.find({ name: regex }).limit(5).lean();

    results.push(
      ...sites.map((s) => ({
        id: `site-${s._id}`,
        type: "entity",
        title: s.name,
        description: "Sitio de rondas",
        section: "Rondas",
        path: "/rondas",
      }))
    );
  }

  /* =========================
     ASIGNACIONES
  ========================= */
  if (canSearchModule(user, "rondas")) {
    const assigns = await RqAssignment.find({
      guardId: regex,
    })
      .limit(5)
      .lean();

    results.push(
      ...assigns.map((a) => ({
        id: `assign-${a._id}`,
        type: "entity",
        title: `Asignación ${a.date}`,
        description: `Ronda asignada · ${a.status}`,
        section: "Rondas",
        path: "/rondas",
      }))
    );
  }

  /* =========================
     NOTIFICACIONES
  ========================= */
  const notifications = await Notification.find({
    $or: [{ title: regex }, { body: regex }],
  })
    .limit(5)
    .lean();

  results.push(
    ...notifications.map((n) => ({
      id: `notif-${n._id}`,
      type: "entity",
      title: n.title,
      description: "Notificación",
      section: "Notificaciones",
      path: "/notificaciones",
    }))
  );

  return results.slice(0, 20);
}