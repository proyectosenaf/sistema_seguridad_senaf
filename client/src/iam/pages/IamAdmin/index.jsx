// client/src/iam/pages/IamAdmin/index.jsx
import React, { useEffect, useMemo, useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";

import IamGuard from "../../api/IamGuard.jsx";

// Páginas
import UsersPage from "./UsersPage.jsx";
import RolesPage from "./RolesPage.jsx";
import PermissionCatalog from "./PermissionCatalog/PermissionCatalog.jsx";
import AuditPage from "./AuditPage.jsx";

/**
 * IamAdmin
 * - NO llama /me aquí (lo hace App.jsx)
 * - NO seed desde frontend
 * - NO hardcode de permisos/roles: el backend manda `me.can`
 */
export default function IamAdmin({ me, meLoading }) {
  const [refreshNonce, setRefreshNonce] = useState(0);

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

  const handlePermissionsSaved = useCallback(() => {
    setRefreshNonce((n) => n + 1);
  }, []);

  return (
    <IamGuard
      me={me}
      meLoading={meLoading}
      routeKey="iam.admin"
      fallback={<div className="p-6">Cargando…</div>}
      unauthorized={<div className="p-6">No autorizado</div>}
    >
      <div className="p-4 md:p-6 space-y-4 layer-content">
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

        <section
          role="tabpanel"
          id="panel-users"
          aria-labelledby="tab-users"
          hidden={activeTab !== "users"}
        >
          {activeTab === "users" && <UsersPage />}
        </section>

        <section
          role="tabpanel"
          id="panel-roles"
          aria-labelledby="tab-roles"
          hidden={activeTab !== "roles"}
        >
          {activeTab === "roles" && <RolesPage key={`roles-${refreshNonce}`} />}
        </section>

        <section
          role="tabpanel"
          id="panel-perms"
          aria-labelledby="tab-perms"
          hidden={activeTab !== "perms"}
        >
          {activeTab === "perms" && (
            <PermissionCatalog
              key={`perms-${refreshNonce}`}
              onSaved={handlePermissionsSaved}
            />
          )}
        </section>

        <section
          role="tabpanel"
          id="panel-audit"
          aria-labelledby="tab-audit"
          hidden={activeTab !== "audit"}
        >
          {activeTab === "audit" && <AuditPage />}
        </section>
      </div>
    </IamGuard>
  );
}