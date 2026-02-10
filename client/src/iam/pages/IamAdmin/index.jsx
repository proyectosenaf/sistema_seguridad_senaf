// src/iam/pages/IamAdmin/index.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";

import IamGuard from "../../api/IamGuard.jsx";

// Páginas
import UsersPage from "./UsersPage.jsx";
import RolesPage from "./RolesPage.jsx";
import PermissionCatalog from "./PermissionCatalog/PermissionCatalog.jsx";
import AuditPage from "./AuditPage.jsx";

import { iamApi } from "../../api/iamApi.js";
import { permisosKeys, rolesKeys } from "../../catalog/perms.js";

const AUTH_AUDIENCE = import.meta.env.VITE_AUTH0_AUDIENCE;

/* =========================
   Helpers normalización
========================= */
function pickListPayload(x) {
  // Soporta: {items:[...]} | {permissions:[...]} | {roles:[...]} | {data:[...]} | [...]
  if (!x) return [];
  if (Array.isArray(x)) return x;
  return x.items || x.permissions || x.roles || x.data || [];
}

function permKeyOf(p) {
  return p?.key || p?.name || p?.code || p?._id || p?.id || null;
}
function roleCodeOf(r) {
  return r?.code || r?.name || r?._id || r?.id || null;
}
function rolePermsOf(r) {
  const v = r?.permissions ?? r?.perms ?? [];
  return Array.isArray(v) ? v : [];
}

/** Merge de permisos: agrega faltantes (no borra) */
async function seedFromLocalCatalog(token) {
  // --- PERMISOS
  let existingPerms = [];
  try {
    const res = await iamApi.listPerms(token);
    existingPerms = pickListPayload(res);
  } catch {
    existingPerms = [];
  }

  const have = new Set(existingPerms.map(permKeyOf).filter(Boolean));

  for (const [key, label] of Object.entries(permisosKeys)) {
    if (have.has(key)) continue;
    const group = String(key).split(".")[0];
    const order = 0;
    try {
      await iamApi.createPerm({ key, label, group, order }, token);
      // eslint-disable-next-line no-console
      console.log("[IAM seed] permiso creado:", key);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[IAM seed] no se pudo crear permiso", key, e?.message || e);
    }
  }

  // --- ROLES
  let existingRoles = [];
  try {
    const r = await iamApi.listRoles(token);
    existingRoles = pickListPayload(r);
  } catch {
    existingRoles = [];
  }

  const byCode = new Map(
    existingRoles
      .map((r) => [roleCodeOf(r), r])
      .filter(([k]) => !!k)
  );

  for (const [code, perms] of Object.entries(rolesKeys)) {
    const desired = Array.isArray(perms) ? perms : [];
    const currentRole = byCode.get(code);

    if (!currentRole) {
      try {
        await iamApi.createRole(
          { code, name: code, description: "", permissions: desired },
          token
        );
        // eslint-disable-next-line no-console
        console.log("[IAM seed] rol creado:", code);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[IAM seed] no se pudo crear rol", code, e?.message || e);
      }
      continue;
    }

    const current = rolePermsOf(currentRole);
    const currentSet = new Set(current);
    const desiredSet = new Set(desired);

    const same =
      current.length === desired.length &&
      current.every((k) => desiredSet.has(k));

    if (!same) {
      // ✅ merge seguro: no borra permisos manuales, solo agrega catálogo
      const merged = Array.from(new Set([...currentSet, ...desiredSet]));

      try {
        await iamApi.updateRole(
          currentRole._id || currentRole.id,
          {
            code,
            name: currentRole.name || code,
            description: currentRole.description || "",
            permissions: merged,
          },
          token
        );
        // eslint-disable-next-line no-console
        console.log("[IAM seed] rol actualizado (merge):", code);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[IAM seed] no se pudo actualizar rol", code, e?.message || e);
      }
    }
  }
}

export default function IamAdmin() {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();

  const tabs = useMemo(
    () => [
      { id: "users", label: "Usuarios" },
      { id: "roles", label: "Roles" },
      { id: "perms", label: "Permisos" },
      { id: "audit", label: "Historial" },
    ],
    []
  );
  const tabIds = useMemo(() => tabs.map((t) => t.id), [tabs]);

  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  const activeTab = tabIds.includes(rawTab) ? rawTab : "users";

  useEffect(() => {
    if (!rawTab) {
      const next = new URLSearchParams(searchParams);
      next.set("tab", "users");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeTab = useCallback(
    (id) => {
      if (!tabIds.includes(id)) return;
      const next = new URLSearchParams(searchParams);
      next.set("tab", id);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams, tabIds]
  );

  const [needsSeed, setNeedsSeed] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [checkErr, setCheckErr] = useState("");

  // ✅ FIX: NO offline_access
  const getToken = useCallback(async () => {
    if (!isAuthenticated) return null;
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: AUTH_AUDIENCE || undefined,
          scope: "openid profile email",
        },
      });
      return token || null;
    } catch (e) {
      console.warn("[IamAdmin] no se pudo obtener token:", e?.message || e);
      return null;
    }
  }, [isAuthenticated, getAccessTokenSilently]);

  /**
   * ✅ CHECK “catálogo vacío” (robusto)
   * - Primero intenta con token (si existe)
   * - Si NO hay token, intenta SIN token (modo dev)
   * - Solo muestra error si realmente no se puede consultar
   */
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const token = await getToken();

        // 1) intentamos con token si existe, si no, seguimos en dev sin token
        const [pRes, rRes] = await Promise.all([
          iamApi.listPerms(token || undefined),
          iamApi.listRoles(token || undefined),
        ]);

        const pCount = pickListPayload(pRes).length;
        const rCount = pickListPayload(rRes).length;

        if (!alive) return;

        // Si sí respondió la API, NO es error de token
        setCheckErr("");
        setNeedsSeed(pCount === 0 || rCount === 0);
      } catch (e) {
        if (!alive) return;
        setNeedsSeed(true);
        setCheckErr(e?.message || "No se pudo verificar permisos/roles.");
      }
    })();

    return () => {
      alive = false;
    };
  }, [getToken]);

  const runSeed = useCallback(async () => {
    try {
      setSeeding(true);

      // ✅ para sembrar sí requerimos token (porque create/update deberían ser protegidos)
      const token = await getToken();
      if (!token) throw new Error("No se pudo obtener token de sesión.");

      await seedFromLocalCatalog(token);

      const [pRes, rRes] = await Promise.all([
        iamApi.listPerms(token),
        iamApi.listRoles(token),
      ]);

      const pCount = pickListPayload(pRes).length;
      const rCount = pickListPayload(rRes).length;

      setNeedsSeed(pCount === 0 || rCount === 0);
      setCheckErr("");

      alert("✅ Permisos y roles cargados (merge).");
    } catch (e) {
      alert(e?.message || "❌ No se pudo cargar la plantilla.");
    } finally {
      setSeeding(false);
    }
  }, [getToken]);

  const onKeyDownTabs = useCallback(
    (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const idx = tabs.findIndex((t) => t.id === activeTab);
      if (idx < 0) return;
      const next =
        e.key === "ArrowRight"
          ? tabs[(idx + 1) % tabs.length]
          : tabs[(idx - 1 + tabs.length) % tabs.length];
      changeTab(next.id);
      const btn = document.getElementById(`tab-${next.id}`);
      if (btn) btn.focus();
    },
    [tabs, activeTab, changeTab]
  );

  return (
    <IamGuard
      anyOf={[
        "iam.users.manage",
        "iam.roles.manage",
        "iam.usuarios.gestionar",
        "iam.roles.gestionar",
        "*",
      ]}
    >
      <div className="p-4 md:p-6 space-y-4 layer-content">
        {needsSeed && (
          <div className="rounded-2xl border border-amber-400/40 bg-amber-50/70 dark:bg-amber-900/30 dark:border-amber-500/60 text-amber-900 dark:text-amber-100 px-4 py-3 flex items-center justify-between backdrop-blur-sm">
            <div>
              <div className="font-semibold">Catálogo vacío</div>
              <div className="text-sm opacity-90">
                {checkErr
                  ? `No se pudo consultar la API. ${checkErr}`
                  : "Cargar plantilla de permisos y roles desde el catálogo local."}
              </div>
            </div>

            <button
              className="px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-semibold shadow-sm hover:bg-amber-500 disabled:opacity-60"
              onClick={runSeed}
              disabled={seeding}
            >
              {seeding ? "Cargando…" : "Cargar plantilla"}
            </button>
          </div>
        )}

        <div
          role="tablist"
          aria-label="Secciones IAM"
          className="flex items-center gap-2 flex-wrap"
          onKeyDown={onKeyDownTabs}
        >
          {tabs.map(({ id, label }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={active}
                aria-controls={`panel-${id}`}
                id={`tab-${id}`}
                title={label}
                onClick={() => changeTab(id)}
                className={[
                  "px-4 py-2 rounded-2xl text-sm font-medium transition-colors duration-200 outline-none",
                  "focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:ring-cyan-400/80",
                  active
                    ? "bg-neutral-900/90 text-white dark:bg-white/90 dark:text-neutral-900 shadow-lg shadow-cyan-500/30"
                    : "bg-neutral-100/40 text-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-100 border border-white/10 dark:border-white/5 hover:bg-neutral-200/60 dark:hover:bg-neutral-800/70 backdrop-blur-sm",
                ].join(" ")}
              >
                {label}
              </button>
            );
          })}
        </div>

        <section role="tabpanel" id="panel-users" aria-labelledby="tab-users" hidden={activeTab !== "users"}>
          {activeTab === "users" && <UsersPage />}
        </section>

        <section role="tabpanel" id="panel-roles" aria-labelledby="tab-roles" hidden={activeTab !== "roles"}>
          {activeTab === "roles" && <RolesPage />}
        </section>

        <section role="tabpanel" id="panel-perms" aria-labelledby="tab-perms" hidden={activeTab !== "perms"}>
          {activeTab === "perms" && <PermissionCatalog />}
        </section>

        <section role="tabpanel" id="panel-audit" aria-labelledby="tab-audit" hidden={activeTab !== "audit"}>
          {activeTab === "audit" && <AuditPage />}
        </section>
      </div>
    </IamGuard>
  );
}
