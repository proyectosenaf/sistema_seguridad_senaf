import { Router } from "express";
import IamSession from "../models/IamSession.model.js";
import IamUser from "../models/IamUser.model.js";
import { buildContextFrom } from "../utils/rbac.util.js";
import { logBitacoraEvent } from "../../bitacora/services/bitacora.service.js";
import XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const r = Router();

function normalizeSubToUserId(sub) {
  const raw = String(sub || "").trim();
  if (!raw) return "";
  return raw.startsWith("local|") ? raw.slice(6) : raw;
}

function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function clientIp(req) {
  const xfwd = req.headers["x-forwarded-for"];
  if (Array.isArray(xfwd) && xfwd.length) return String(xfwd[0] || "").trim();

  if (typeof xfwd === "string" && xfwd.trim()) {
    return xfwd.split(",")[0].trim();
  }

  return (
    req.ip ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    ""
  );
}

function getPrimaryRole(userLike) {
  const roles = Array.isArray(userLike?.roles) ? userLike.roles : [];
  const first = roles[0];
  if (!first) return "";
  if (typeof first === "string") return first.trim();
  return String(
    first.name ||
      first.slug ||
      first.code ||
      first.key ||
      first.nombre ||
      first.label ||
      ""
  ).trim();
}

function normalizeRoleName(role) {
  if (!role) return "";
  if (typeof role === "string") return role.trim().toLowerCase();

  if (typeof role === "object") {
    return String(
      role.name ||
        role.slug ||
        role.code ||
        role.key ||
        role.nombre ||
        role.label ||
        ""
    )
      .trim()
      .toLowerCase();
  }

  return String(role).trim().toLowerCase();
}

function getSuperadminEmails() {
  return Array.from(
    new Set(
      [
        process.env.SUPERADMIN_EMAIL,
        process.env.VITE_SUPERADMIN_EMAIL,
        process.env.ROOT_ADMINS,
        "proyectosenaf@gmail.com",
      ]
        .flatMap((v) =>
          String(v || "")
            .split(",")
            .map((x) => x.trim().toLowerCase())
        )
        .filter(Boolean)
    )
  );
}

function isSuperadminEmail(email) {
  const e = normalizeEmail(email);
  return !!e && getSuperadminEmails().includes(e);
}

function isAdminLikeFromContext(ctx = {}) {
  const email = normalizeEmail(ctx?.email || ctx?.user?.email);
  if (isSuperadminEmail(email)) return true;
  if (ctx?.isSuperAdmin) return true;

  const roles = Array.isArray(ctx?.roles)
    ? ctx.roles
    : Array.isArray(ctx?.user?.roles)
      ? ctx.user.roles
      : [];

  const set = new Set(roles.map(normalizeRoleName).filter(Boolean));

  return (
    set.has("admin") ||
    set.has("administrador") ||
    set.has("administrador_it") ||
    set.has("ti") ||
    set.has("superadmin") ||
    set.has("root")
  );
}

function fmtDateTime(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function normalizeBrowserName(ua = "") {
  const s = String(ua || "").toLowerCase();
  if (s.includes("edg/")) return "Edge";
  if (s.includes("opr/") || s.includes("opera")) return "Opera";
  if (s.includes("samsungbrowser")) return "Samsung Browser";
  if (s.includes("chrome/") && !s.includes("edg/")) return "Chrome";
  if (s.includes("firefox/")) return "Firefox";
  if (s.includes("safari/") && !s.includes("chrome/")) return "Safari";
  return "Navegador";
}

function normalizeOsName(ua = "") {
  const s = String(ua || "").toLowerCase();
  if (s.includes("windows nt")) return "Windows";
  if (s.includes("android")) return "Android";
  if (s.includes("iphone") || s.includes("ipad") || s.includes("ios")) {
    return "iOS";
  }
  if (s.includes("mac os") || s.includes("macintosh")) return "macOS";
  if (s.includes("linux")) return "Linux";
  return "Sistema";
}

function summarizeDevice(session = {}) {
  const ua = String(session?.userAgent || session?.device || "").trim();
  if (!ua) return "Dispositivo no identificado";
  return `${normalizeOsName(ua)} / ${normalizeBrowserName(ua)}`;
}

function buildPresenceFromSession(s) {
  const now = Date.now();
  const last = s.lastActivityAt ? new Date(s.lastActivityAt).getTime() : 0;
  const diffMs = last > 0 ? now - last : Number.MAX_SAFE_INTEGER;

  if (s.isActive) {
    if (diffMs <= 2 * 60 * 1000) return "online";
    if (diffMs <= 10 * 60 * 1000) return "idle";
    return "inactive";
  }

  return String(s.status || "offline").toLowerCase();
}

function mapSessionWithUser(s, user = null) {
  return {
    _id: String(s._id),
    sessionId: s.sessionId,
    userId: String(s.userId || ""),
    email: s.email || user?.email || "",
    name: user?.name || s.email || "",
    roles: Array.isArray(user?.roles) ? user.roles : [],
    userActive: user?.active !== false,
    isActive: s.isActive === true,
    status: s.status || "active",
    presence: buildPresenceFromSession(s),
    ip: s.ip || "",
    userAgent: s.userAgent || "",
    device: s.device || "",
    connectedAt: s.connectedAt || null,
    lastActivityAt: s.lastActivityAt || null,
    disconnectedAt: s.disconnectedAt || null,
    logoutAt: s.logoutAt || null,
    kickedAt: s.kickedAt || null,
    reason: s.reason || "",
  };
}

function toExportRows(items = []) {
  return items.map((s, idx) => ({
    "#": idx + 1,
    Usuario: s.name || "—",
    Correo: s.email || "—",
    Estado: s.status || s.presence || "—",
    Presencia: s.presence || "—",
    IP: s.ip || "—",
    Dispositivo: summarizeDevice(s),
    "User Agent": s.device || s.userAgent || "—",
    "Conectado": fmtDateTime(s.connectedAt),
    "Última actividad": fmtDateTime(s.lastActivityAt),
    "Desconectado": fmtDateTime(s.disconnectedAt || s.logoutAt || s.kickedAt),
    Motivo: s.reason || "—",
    "Session ID": s.sessionId || "—",
  }));
}

function escapeCsvValue(v) {
  const s = String(v ?? "");
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function ensureAdmin(req, res, next) {
  try {
    const ctx = req.iam || (await buildContextFrom(req));
    req.iam = ctx;

    if (!ctx?.email) {
      return res.status(401).json({ ok: false, message: "No autenticado" });
    }

    const canView =
      ctx.isSuperAdmin ||
      ctx.has("iam.sessions.read") ||
      ctx.has("iam.users.manage") ||
      ctx.has("iam.users.write") ||
      ctx.has("iam.roles.manage") ||
      ctx.has("iam.admin");

    if (!canView) {
      return res.status(403).json({
        ok: false,
        message: "forbidden",
        need: [
          "iam.sessions.read",
          "iam.users.manage",
          "iam.users.write",
          "iam.roles.manage",
          "iam.admin",
        ],
        email: ctx.email,
        roles: ctx.roles || [],
        perms: ctx.permissions || [],
      });
    }

    next();
  } catch (e) {
    next(e);
  }
}

async function ensureAdminKick(req, res, next) {
  try {
    const ctx = req.iam || (await buildContextFrom(req));
    req.iam = ctx;

    if (!ctx?.email) {
      return res.status(401).json({ ok: false, message: "No autenticado" });
    }

    const canKick =
      ctx.isSuperAdmin ||
      ctx.has("iam.sessions.kick") ||
      ctx.has("iam.users.manage") ||
      ctx.has("iam.users.write") ||
      ctx.has("iam.admin");

    if (!canKick) {
      return res.status(403).json({
        ok: false,
        message: "forbidden",
        need: [
          "iam.sessions.kick",
          "iam.users.manage",
          "iam.users.write",
          "iam.admin",
        ],
        email: ctx.email,
        roles: ctx.roles || [],
        perms: ctx.permissions || [],
      });
    }

    next();
  } catch (e) {
    next(e);
  }
}

async function bitacoraSafe(req, payload, label) {
  try {
    await logBitacoraEvent({
      modulo: "IAM",
      tipo: "IAM",
      prioridad: payload.prioridad || "Media",
      estado: payload.estado || "Registrado",
      source: payload.source || "iam-sessions",
      agente:
        req?.user?.email ||
        req?.user?.name ||
        payload.agente ||
        "Sistema IAM",
      actorId:
        req?.user?.sub ||
        req?.user?._id ||
        req?.user?.id ||
        payload.actorId ||
        "",
      actorEmail: req?.user?.email || payload.actorEmail || "",
      actorRol: getPrimaryRole(req?.user) || payload.actorRol || "",
      ip: clientIp(req),
      userAgent: req?.get?.("user-agent") || "",
      ...payload,
    });
  } catch (e) {
    console.warn(
      `[IAM][BITACORA ${label}] error (no bloquea):`,
      e?.message || e
    );
  }
}

async function loadUsersMapFromSessions(sessions = []) {
  const userIds = [
    ...new Set(
      sessions
        .map((s) => String(s.userId || "").trim())
        .filter(Boolean)
    ),
  ];

  const users = userIds.length
    ? await IamUser.find({ _id: { $in: userIds } })
        .select("_id email name roles active")
        .lean()
    : [];

  return new Map(users.map((u) => [String(u._id), u]));
}

r.get("/", ensureAdmin, async (req, res, next) => {
  try {
    const onlyActive = String(req.query.onlyActive || "1") !== "0";
    const q = String(req.query.q || "").trim().toLowerCase();
    const limitRaw = Number(req.query.limit || 100);
    const limit = Number.isFinite(limitRaw)
      ? Math.max(1, Math.min(limitRaw, 500))
      : 100;

    const baseQuery = onlyActive ? { isActive: true } : {};

    const sessions = await IamSession.find(baseQuery)
      .sort({ lastActivityAt: -1, connectedAt: -1 })
      .limit(limit)
      .lean();

    const userMap = await loadUsersMapFromSessions(sessions);

    const items = sessions
      .map((s) => mapSessionWithUser(s, userMap.get(String(s.userId || "")) || null))
      .filter((item) => {
        if (!q) return true;
        return (
          String(item.email || "").toLowerCase().includes(q) ||
          String(item.name || "").toLowerCase().includes(q) ||
          String(item.ip || "").toLowerCase().includes(q) ||
          String(item.status || "").toLowerCase().includes(q) ||
          String(item.presence || "").toLowerCase().includes(q)
        );
      });

    return res.json({
      ok: true,
      items,
      meta: {
        total: items.length,
        onlyActive,
        limit,
      },
    });
  } catch (e) {
    next(e);
  }
});

r.get("/online", ensureAdmin, async (req, res, next) => {
  try {
    const sessions = await IamSession.find({ isActive: true })
      .sort({ lastActivityAt: -1 })
      .lean();

    const items = sessions.map((s) => ({
      sessionId: s.sessionId,
      userId: String(s.userId || ""),
      email: s.email || "",
      presence: buildPresenceFromSession(s),
      ip: s.ip || "",
      userAgent: s.userAgent || "",
      device: s.device || "",
      connectedAt: s.connectedAt || null,
      lastActivityAt: s.lastActivityAt || null,
    }));

    return res.json({ ok: true, items });
  } catch (e) {
    next(e);
  }
});

r.get("/history", ensureAdmin, async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim().toLowerCase();
    const pageRaw = Number(req.query.page || 1);
    const limitRaw = Number(req.query.limit || 5);

    const page = Number.isFinite(pageRaw) ? Math.max(1, pageRaw) : 1;
    const limit = Number.isFinite(limitRaw)
      ? Math.max(1, Math.min(limitRaw, 100))
      : 5;

    const skip = (page - 1) * limit;

    let filter = {};
    if (q) {
      filter = {
        $or: [
          { email: { $regex: q, $options: "i" } },
          { ip: { $regex: q, $options: "i" } },
          { device: { $regex: q, $options: "i" } },
          { userAgent: { $regex: q, $options: "i" } },
          { status: { $regex: q, $options: "i" } },
          { reason: { $regex: q, $options: "i" } },
        ],
      };
    }

    const [total, sessions] = await Promise.all([
      IamSession.countDocuments(filter),
      IamSession.find(filter)
        .sort({ connectedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const userMap = await loadUsersMapFromSessions(sessions);

    const items = sessions.map((s) =>
      mapSessionWithUser(s, userMap.get(String(s.userId || "")) || null)
    );

    return res.json({
      ok: true,
      items,
      meta: {
        total,
        page,
        limit,
        pages: Math.max(1, Math.ceil(total / limit)),
        hasMore: skip + items.length < total,
      },
    });
  } catch (e) {
    next(e);
  }
});

r.get("/history/export", ensureAdmin, async (req, res, next) => {
  try {
    const format = String(req.query.format || "csv").trim().toLowerCase();
    const q = String(req.query.q || "").trim().toLowerCase();

    let filter = {};
    if (q) {
      filter = {
        $or: [
          { email: { $regex: q, $options: "i" } },
          { ip: { $regex: q, $options: "i" } },
          { device: { $regex: q, $options: "i" } },
          { userAgent: { $regex: q, $options: "i" } },
          { status: { $regex: q, $options: "i" } },
          { reason: { $regex: q, $options: "i" } },
        ],
      };
    }

    const sessions = await IamSession.find(filter)
      .sort({ connectedAt: -1, createdAt: -1 })
      .limit(10000)
      .lean();

    const userMap = await loadUsersMapFromSessions(sessions);
    const items = sessions.map((s) =>
      mapSessionWithUser(s, userMap.get(String(s.userId || "")) || null)
    );
    const rows = toExportRows(items);

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

    if (format === "csv") {
      const headers = rows.length ? Object.keys(rows[0]) : [];
      const csv = [
        headers.join(","),
        ...rows.map((row) =>
          headers.map((h) => escapeCsvValue(row[h])).join(",")
        ),
      ].join("\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="historial_ingresos_${stamp}.csv"`
      );
      return res.send("\uFEFF" + csv);
    }

    if (format === "xlsx" || format === "excel") {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Historial");
      const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="historial_ingresos_${stamp}.xlsx"`
      );
      return res.send(buffer);
    }

    if (format === "pdf") {
      const doc = new jsPDF("l", "pt", "a4");
      doc.setFontSize(14);
      doc.text("Historial de ingresos / sesiones", 40, 34);

      autoTable(doc, {
        startY: 50,
        head: [
          [
            "#",
            "Usuario",
            "Correo",
            "Estado",
            "IP",
            "Dispositivo",
            "Conectado",
            "Última actividad",
            "Desconectado",
          ],
        ],
        body: rows.map((r) => [
          r["#"],
          r["Usuario"],
          r["Correo"],
          r["Estado"],
          r["IP"],
          r["Dispositivo"],
          r["Conectado"],
          r["Última actividad"],
          r["Desconectado"],
        ]),
        styles: {
          fontSize: 8,
          cellPadding: 4,
        },
        headStyles: {
          fillColor: [37, 99, 235],
        },
      });

      const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="historial_ingresos_${stamp}.pdf"`
      );
      return res.send(pdfBuffer);
    }

    return res.status(400).json({
      ok: false,
      message: "Formato no soportado. Usa csv, xlsx o pdf.",
    });
  } catch (e) {
    next(e);
  }
});

r.post("/:sessionId/kick", ensureAdminKick, async (req, res, next) => {
  try {
    const sessionId = String(req.params.sessionId || "").trim();
    if (!sessionId) {
      return res.status(400).json({ ok: false, message: "sessionId requerido" });
    }

    const before = await IamSession.findOne({ sessionId }).lean();
    if (!before) {
      return res.status(404).json({ ok: false, message: "Sesión no encontrada" });
    }

    await IamSession.updateOne(
      { sessionId },
      {
        $set: {
          isActive: false,
          status: "kicked",
          kickedAt: new Date(),
          disconnectedAt: new Date(),
          reason: "Sesión cerrada por administrador",
        },
      }
    );

    await bitacoraSafe(
      req,
      {
        accion: "SESSION_KICK",
        entidad: "IamSession",
        entidadId: String(before._id || ""),
        titulo: `Sesión cerrada: ${before.email || before.sessionId}`,
        descripcion: `Se cerró manualmente la sesión ${before.sessionId}.`,
        before: {
          sessionId: before.sessionId,
          email: before.email || "",
          isActive: before.isActive === true,
          status: before.status || "",
        },
        after: {
          sessionId: before.sessionId,
          email: before.email || "",
          isActive: false,
          status: "kicked",
        },
        estado: "Exitoso",
        prioridad: "Alta",
        nombre: before.email || before.sessionId,
      },
      "kick session"
    );

    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

r.post("/me/logout", async (req, res, next) => {
  try {
    const ctx = req.iam || (await buildContextFrom(req));
    req.iam = ctx;

    const sessionId = String(
      req.sessionId || req?.auth?.payload?.sid || ""
    ).trim();

    if (!ctx?.email || !sessionId) {
      return res.status(401).json({ ok: false, message: "No autenticado" });
    }

    const before = await IamSession.findOne({ sessionId }).lean();

    if (before) {
      await IamSession.updateOne(
        { sessionId },
        {
          $set: {
            isActive: false,
            status: "closed",
            logoutAt: new Date(),
            disconnectedAt: new Date(),
            reason: "Logout manual",
          },
        }
      );

      await bitacoraSafe(
        req,
        {
          accion: "SESSION_LOGOUT",
          entidad: "IamSession",
          entidadId: String(before._id || ""),
          titulo: `Logout de sesión: ${before.email || before.sessionId}`,
          descripcion: `El usuario cerró manualmente la sesión ${before.sessionId}.`,
          before: {
            sessionId: before.sessionId,
            email: before.email || "",
            isActive: before.isActive === true,
            status: before.status || "",
          },
          after: {
            sessionId: before.sessionId,
            email: before.email || "",
            isActive: false,
            status: "closed",
          },
          estado: "Exitoso",
          prioridad: "Media",
          nombre: before.email || before.sessionId,
        },
        "logout session"
      );
    }

    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

r.post("/heartbeat", async (req, res, next) => {
  try {
    const ctx = req.iam || (await buildContextFrom(req));
    req.iam = ctx;

    const sessionId = String(
      req.sessionId || req?.auth?.payload?.sid || ""
    ).trim();

    const userId = normalizeSubToUserId(
      req?.user?.sub || req?.auth?.payload?.sub || ctx?.user?._id || ""
    );

    if (!ctx?.email || !sessionId) {
      return res.status(401).json({ ok: false, message: "No autenticado" });
    }

    const isAdminLike = isAdminLikeFromContext(ctx);

    if (isAdminLike) {
      await IamSession.updateOne(
        { sessionId, isActive: true },
        {
          $set: {
            lastActivityAt: new Date(),
            ip: clientIp(req),
            userAgent: req.get?.("user-agent") || "",
          },
        }
      );

      return res.json({ ok: true, ts: Date.now() });
    }

    const session = await IamSession.findOne({
      sessionId,
      userId,
      isActive: true,
    }).lean();

    if (!session) {
      return res.status(401).json({
        ok: false,
        error: "session_invalidated",
        forceLogout: true,
        message:
          "Solo se permite una sesión activa por cuenta. Tu sesión fue cerrada porque iniciaste sesión en otro dispositivo.",
      });
    }

    await IamSession.updateOne(
      { sessionId, userId, isActive: true },
      {
        $set: {
          lastActivityAt: new Date(),
          ip: clientIp(req),
          userAgent: req.get?.("user-agent") || "",
        },
      }
    );

    return res.json({ ok: true, ts: Date.now() });
  } catch (e) {
    next(e);
  }
});

export default r;