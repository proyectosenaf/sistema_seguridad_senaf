import { Router } from "express";
import IamSession from "../models/IamSession.model.js";
import IamUser from "../models/IamUser.model.js";
import { buildContextFrom } from "../utils/rbac.util.js";
import { logBitacoraEvent } from "../../bitacora/services/bitacora.service.js";

const r = Router();

function normalizeSubToUserId(sub) {
  const raw = String(sub || "").trim();
  if (!raw) return "";
  return raw.startsWith("local|") ? raw.slice(6) : raw;
}

function clientIp(req) {
  return (
    req.ip ||
    req.headers["x-forwarded-for"] ||
    req.connection?.remoteAddress ||
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

    const userMap = new Map(
      users.map((u) => [String(u._id), u])
    );

    const items = sessions
      .map((s) => {
        const user = userMap.get(String(s.userId || "")) || null;
        const now = Date.now();
        const last =
          s.lastActivityAt ? new Date(s.lastActivityAt).getTime() : 0;
        const diffMs = last > 0 ? now - last : Number.MAX_SAFE_INTEGER;

        let presence = "offline";
        if (s.isActive) {
          if (diffMs <= 2 * 60 * 1000) presence = "online";
          else if (diffMs <= 10 * 60 * 1000) presence = "idle";
          else presence = "inactive";
        }

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
          presence,
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
      })
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

    const now = Date.now();

    const items = sessions.map((s) => {
      const last = s.lastActivityAt ? new Date(s.lastActivityAt).getTime() : 0;
      const diffMs = last > 0 ? now - last : Number.MAX_SAFE_INTEGER;

      let presence = "offline";
      if (diffMs <= 2 * 60 * 1000) presence = "online";
      else if (diffMs <= 10 * 60 * 1000) presence = "idle";
      else presence = "inactive";

      return {
        sessionId: s.sessionId,
        userId: String(s.userId || ""),
        email: s.email || "",
        presence,
        ip: s.ip || "",
        userAgent: s.userAgent || "",
        device: s.device || "",
        connectedAt: s.connectedAt || null,
        lastActivityAt: s.lastActivityAt || null,
      };
    });

    return res.json({ ok: true, items });
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

    const sessionId =
      String(req.sessionId || req?.auth?.payload?.sid || "").trim();

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

    const sessionId =
      String(req.sessionId || req?.auth?.payload?.sid || "").trim();

    if (!ctx?.email || !sessionId) {
      return res.status(401).json({ ok: false, message: "No autenticado" });
    }

    await IamSession.updateOne(
      { sessionId, isActive: true },
      { $set: { lastActivityAt: new Date() } }
    );

    return res.json({ ok: true, ts: Date.now() });
  } catch (e) {
    next(e);
  }
});

export default r;