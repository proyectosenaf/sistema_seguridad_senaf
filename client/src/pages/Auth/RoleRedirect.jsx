// client/src/pages/Auth/RoleRedirect.jsx
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { iamApi } from "../../iam/iamApi";

function pickHome({ roles = [], perms = [] }) {
  const R = new Set(roles);
  const P = new Set(perms);

  // Admin o quien gestiona IAM → panel de IAM
  if (R.has("admin") || P.has("iam.users.manage")) return "/iam/admin";

  // Rutas por rol
  if (R.has("supervisor")) return "/rondas/admin";
  if (R.has("guardia"))    return "/rondas/guard";
  if (R.has("recepcion"))  return "/accesos";          // o "/visitas"
  if (R.has("analista"))   return "/rondas/dashboard";
  if (R.has("ti"))         return "/iam/admin";

  // Sin match: a Home
  return "/";
}

export default function RoleRedirect() {
  const nav = useNavigate();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const me = await iamApi.me();
        const roles = me?.roles || me?.user?.roles || [];
        const perms = me?.permissions || me?.perms || [];
        const dest  = pickHome({ roles, perms });
        if (alive) nav(dest, { replace: true });
      } catch {
        if (alive) nav("/", { replace: true });
      }
    })();
    return () => { alive = false; };
  }, [nav]);

  return <div className="p-6">Redirigiendo…</div>;
}
