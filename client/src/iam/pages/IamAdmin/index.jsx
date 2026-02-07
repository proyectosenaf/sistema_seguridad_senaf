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

/** Si BD está vacía, crea permisos/roles desde el catálogo local */
async function seedFromLocalCatalog(token) {
  // --- PERMISOS
  let existingPerms = [];
  try {
    const res = await iamApi.listPerms(token);
    existingPerms = res?.items || res?.permissions || [];
  } catch {
    existingPerms = [];
  }

  const have = new Set(existingPerms.map((p) => p.key || p.name).filter(Boolean));

  for (const [key, label] of Object.entries(permisosKeys)) {
    if (have.has(key)) continue;
    const group = key.split(".")[0];
    const order = 0;
    try {
      await iamApi.createPerm({ key, label, group, order }, token);
      console.log("[IAM seed] permiso creado:", key);
    } catch (e) {
      console.warn("[IAM seed] no se pudo crear permiso", key, e?.message || e);
    }
  }

  // --- ROLES
  let existingRoles = [];
  try {
    const r = await iamApi.listRoles(token);
    existingRoles = r?.items || r?.roles || [];
  } catch {
    existingRoles = [];
  }

  const byCode = new Map(
    existingRoles
      .map((r) => [r?.code || r?.name || r?._id, r])
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
        console.log("[IAM seed] rol creado:", code);
      } catch (e) {
        console.warn("[IAM seed] no se pudo crear rol", code, e?.message || e);
      }
    } else {
      const current = Array.isArray(currentRole.permissions || currentRole.perms)
        ? currentRole.permissions || currentRole.perms
        : [];

      const same =
        current.length === desired.length &&
        current.every((k) => desired.includes(k));

      if (!same) {
        try {
          await iamApi.updateRole(
            currentRole._id || currentRole.id,
            {
              code,
              name: currentRole.name || code,
              description: currentRole.description || "",
              permissions: desired,
            },
            token
          );
          console.log("[IAM seed] rol actualizado:", code);
        } catch (e) {
          console.warn("[IAM seed] no se pudo actualizar rol", code, e?.message || e);
        }
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

  const getToken = useCallback(async () => {
    if (!isAuthenticated) return null;
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: AUTH_AUDIENCE,
          scope: "openid profile email offline_access",
        },
      });
      return token || null;
    } catch (e) {
      console.warn("[IamAdmin] no se pudo obtener token:", e?.message || e);
      return null;
    }
  }, [isAuthenticated, getAccessTokenSilently]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const token = await getToken();
        if (!token) {
          if (alive) {
            setNeedsSeed(true);
            setCheckErr("No se pudo obtener token de sesión.");
          }
          return;
        }

        setCheckErr("");
        const [p, r] = await Promise.all([iamApi.listPerms(token), iamApi.listRoles(token)]);
        const pCount = (p?.items || p?.permissions || []).length;
        const rCount = (r?.items || r?.roles || []).length;
        if (alive) setNeedsSeed(pCount === 0 || rCount === 0);
      } catch (e) {
        if (alive) {
          setNeedsSeed(true);
          setCheckErr(e?.message || "No se pudo verificar permisos/roles.");
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [getToken]);

  const runSeed = useCallback(async () => {
    try {
      setSeeding(true);
      const token = await getToken();
      if (!token) throw new Error("No se pudo obtener token de sesión.");

      await seedFromLocalCatalog(token);

      const [p, r] = await Promise.all([iamApi.listPerms(token), iamApi.listRoles(token)]);
      const pCount = (p?.items || p?.permissions || []).length;
      const rCount = (r?.items || r?.roles || []).length;
      setNeedsSeed(pCount === 0 || rCount === 0);

      alert("✅ Permisos y roles cargados.");
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
    <IamGuard anyOf={["iam.usuarios.gestionar", "iam.roles.gestionar", "*"]}>
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
