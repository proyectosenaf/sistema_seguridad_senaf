import { Router } from "express";
import { buildContextFrom } from "../utils/rbac.util.js";
import IamUser from "../models/IamUser.model.js";

const r = Router();

function nameFromEmail(email = "") {
  const local = String(email || "").split("@")[0] || "";
  if (!local) return "";
  return local
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

r.get("/", async (req, res, next) => {
  try {
    // 1️⃣ Construir contexto desde el request real
    let ctx = await buildContextFrom(req);

    const email = (ctx?.email || "").toLowerCase();
    const auth0Sub = ctx?.auth0Sub || null;

    // 2️⃣ Sin identidad real -> visitante público
    if (!email && !auth0Sub) {
      return res.json({
        ok: true,
        user: null,
        roles: [],
        permissions: [],
        visitor: true,
        email: null,
        isSuperAdmin: false,
      });
    }

    // 3️⃣ Si no existe usuario en Mongo -> crear automáticamente
    let user = ctx.user;

    if (!user && email) {
      user = await IamUser.findOne({ email });

      if (!user) {
        user = await IamUser.create({
          email,
          name: nameFromEmail(email),
          roles: ["visita"],   // ✅ rol default
          perms: [],
          active: true,
          provider: "auth0",
          auth0Sub: auth0Sub || undefined,
        });
      }
    }

    // 4️⃣ Respuesta final consistente
    return res.json({
      ok: true,
      user: user || null,
      roles: user?.roles || [],
      permissions: user?.perms || [],
      visitor: user?.roles?.includes("visita") || false,
      email: email || null,
      isSuperAdmin: ctx?.isSuperAdmin || false,
      auth0Sub: auth0Sub || null,
    });
  } catch (e) {
    console.error("[IAM /me]", e);
    next(e);
  }
});

export default r;