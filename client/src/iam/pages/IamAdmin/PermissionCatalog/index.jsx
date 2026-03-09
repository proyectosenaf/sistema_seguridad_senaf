// client/src/iam/pages/IamAdmin/PermissionCatalog/index.jsx
import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";

import HeaderRow from "./components/HeaderRow";
import GroupSection from "./components/GroupSection";
import Modal from "./components/Modal";
import { Plus, Eye, Minus, Square } from "lucide-react";

import { iamApi } from "../../../api/iamApi.js";

/* =========================
  Helpers
========================= */
function asListPayload(x) {
  if (!x) return [];
  if (Array.isArray(x)) return x;
  return x.items || x.permissions || x.roles || x.data || [];
}

function roleIdOf(r) {
  return r?._id || r?.id || null;
}

function rolePermsOf(r) {
  const v = r?.permissions ?? r?.perms ?? [];
  return Array.isArray(v) ? v : [];
}

function groupFromKey(key) {
  const s = String(key || "").trim().toLowerCase();
  const i = s.indexOf(".");
  return i > 0 ? s.slice(0, i).toLowerCase() : "general";
}

function normalizePermKey(key) {
  return String(key || "").trim().toLowerCase();
}

function normalizePermList(list = []) {
  const arr = Array.isArray(list) ? list : [list];
  return [...new Set(arr.map(normalizePermKey).filter(Boolean))];
}

function buildGroupsFromPerms(perms = []) {
  const map = new Map();
  for (const p of perms) {
    const g = String(p.group || groupFromKey(p.key) || "general").toLowerCase();
    if (!map.has(g)) map.set(g, []);
    map.get(g).push({
      ...p,
      key: normalizePermKey(p.key),
      group: g,
    });
  }
  const groups = [...map.entries()].map(([group, items]) => ({ group, items }));
  groups.sort((a, b) => a.group.localeCompare(b.group));
  for (const g of groups) {
    g.items.sort((a, b) => {
      const ao = Number.isFinite(Number(a.order)) ? Number(a.order) : 0;
      const bo = Number.isFinite(Number(b.order)) ? Number(b.order) : 0;
      if (ao !== bo) return ao - bo;
      return String(a.key || "").localeCompare(String(b.key || ""));
    });
  }
  return groups;
}

function cloneMatrix(m) {
  const out = {};
  for (const [rid, v] of Object.entries(m || {})) out[rid] = { ...(v || {}) };
  return out;
}

function rowPermsFromMatrixRow(row = {}) {
  return normalizePermList(
    Object.entries(row)
      .filter(([, v]) => v === true)
      .map(([k]) => k)
  );
}

function samePermLists(a = [], b = []) {
  const aa = normalizePermList(a);
  const bb = normalizePermList(b);
  if (aa.length !== bb.length) return false;
  for (let i = 0; i < aa.length; i++) {
    if (aa[i] !== bb[i]) return false;
  }
  return true;
}

/* =========================
  Data inline (SIN hooks/)
========================= */
function usePermissionCatalogDataInline(onSaved) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [banner, setBanner] = useState(null);

  const [roles, setRoles] = useState([]);
  const [groups, setGroups] = useState([]);

  const [roleMatrix, setRoleMatrix] = useState({});
  const [origMatrix, setOrigMatrix] = useState({});

  const [query, setQuery] = useState("");
  const [compactView, setCompactView] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    setBanner(null);

    try {
      const [rRes, pRes] = await Promise.all([iamApi.listRoles(), iamApi.listPerms({})]);

      const rolesList = asListPayload(rRes);
      const permsList = asListPayload(pRes);

      const normalizedPerms = permsList.map((p) => ({
        ...p,
        key: normalizePermKey(p.key),
        group: String(p.group || groupFromKey(p.key)).toLowerCase(),
      }));

      const groupsBuilt =
        Array.isArray(pRes?.groups) && pRes.groups.length
          ? pRes.groups.map((g) => ({
              ...g,
              group: String(g.group || "general").toLowerCase(),
              items: Array.isArray(g.items)
                ? g.items.map((it) => ({
                    ...it,
                    key: normalizePermKey(it.key),
                    group: String(it.group || g.group || groupFromKey(it.key)).toLowerCase(),
                  }))
                : [],
            }))
          : buildGroupsFromPerms(normalizedPerms);

      const m = {};
      for (const r of rolesList) {
        const rid = roleIdOf(r);
        if (!rid) continue;

        const keys = normalizePermList(rolePermsOf(r));
        const row = {};
        for (const k of keys) row[k] = true;
        m[String(rid)] = row;
      }

      setRoles(rolesList);
      setGroups(groupsBuilt);
      setRoleMatrix(m);
      setOrigMatrix(cloneMatrix(m));
    } catch (e) {
      setErrorMsg(e?.message || "Error cargando permisos/roles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const onToggle = useCallback((roleId, permKey) => {
    const rid = String(roleId || "");
    const pk = normalizePermKey(permKey);
    if (!rid || !pk) return;

    setRoleMatrix((prev) => {
      const next = cloneMatrix(prev);
      const row = next[rid] ? { ...next[rid] } : {};
      row[pk] = !row[pk];
      next[rid] = row;
      return next;
    });
  }, []);

  const onSaveAll = useCallback(async () => {
    if (saving) return;

    try {
      setSaving(true);
      setBanner(null);
      setErrorMsg("");

      const changedRoles = roles.filter((r) => {
        const rid = String(roleIdOf(r) || "");
        if (!rid) return false;

        const current = rowPermsFromMatrixRow(roleMatrix[rid] || {});
        const original = rowPermsFromMatrixRow(origMatrix[rid] || {});
        return !samePermLists(current, original);
      });

      if (!changedRoles.length) {
        setBanner({ type: "warn", msg: "No hay cambios por guardar." });
        return;
      }

      for (const r of changedRoles) {
        const rid = String(roleIdOf(r) || "");
        if (!rid) continue;

        const nextPerms = rowPermsFromMatrixRow(roleMatrix[rid] || {});

        if (typeof iamApi.updateRolePermissions === "function") {
          await iamApi.updateRolePermissions(rid, { permissions: nextPerms });
        } else if (typeof iamApi.setRolePerms === "function") {
          await iamApi.setRolePerms(rid, nextPerms);
        } else {
          await iamApi.updateRole(rid, { permissions: nextPerms });
        }
      }

      await loadAll();

      if (typeof onSaved === "function") {
        onSaved();
      }

      setBanner({ type: "ok", msg: "✅ Cambios guardados." });
    } catch (e) {
      setBanner({ type: "err", msg: e?.message || "❌ Error guardando cambios." });
    } finally {
      setSaving(false);
    }
  }, [roles, roleMatrix, origMatrix, saving, loadAll, onSaved]);

  const onCreatePerm = useCallback(
    async (form) => {
      try {
        setBanner(null);
        setErrorMsg("");

        const keyRaw = normalizePermKey(form?.key);
        const label = String(form?.label || "").trim();
        const group = String(form?.moduleValue || groupFromKey(keyRaw) || "general")
          .trim()
          .toLowerCase();

        if (!keyRaw || !label || !group) {
          setBanner({ type: "warn", msg: "Completa key, label y módulo." });
          return false;
        }

        await iamApi.createPerm({
          key: keyRaw,
          label,
          group,
          order: 0,
        });

        setBanner({ type: "ok", msg: "✅ Permiso creado." });
        await loadAll();
        return true;
      } catch (e) {
        setBanner({ type: "err", msg: e?.message || "❌ No se pudo crear." });
        return false;
      }
    },
    [loadAll]
  );

  const onDeletePerm = useCallback(
    async (it) => {
      try {
        setBanner(null);
        setErrorMsg("");

        const id = it?.id || it?._id;
        if (!id) throw new Error("ID de permiso requerido para eliminar.");

        await iamApi.deletePerm(String(id));
        setBanner({ type: "ok", msg: "✅ Permiso eliminado." });
        await loadAll();
        return true;
      } catch (e) {
        setBanner({ type: "err", msg: e?.message || "❌ No se pudo eliminar." });
        return false;
      }
    },
    [loadAll]
  );

  return {
    loading,
    saving,
    errorMsg,
    banner,
    roles,
    groups,
    roleMatrix,
    origMatrix,
    query,
    setQuery,
    compactView,
    setCompactView,
    onToggle,
    onSaveAll,
    onCreatePerm,
    onDeletePerm,
  };
}

/* =========================
  Component
========================= */
export default function PermissionCatalog({ onSaved }) {
  const {
    loading,
    saving,
    errorMsg,
    banner,
    roles,
    groups,
    roleMatrix,
    origMatrix,
    query,
    setQuery,
    compactView,
    setCompactView,
    onToggle,
    onSaveAll,
    onCreatePerm,
    onDeletePerm,
  } = usePermissionCatalogDataInline(onSaved);

  const scrollRef = useRef(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [form, setForm] = useState({ key: "", label: "", moduleValue: "bitacora" });
  const [openDelete, setOpenDelete] = useState(null);

  const [expandedGroupsCompact, setExpandedGroupsCompact] = useState(() => new Set());
  const [expandedGroupsFull, setExpandedGroupsFull] = useState(() => new Set());

  const toggleGroupCompact = (groupKey) => {
    setExpandedGroupsCompact((prev) => {
      const next = new Set(prev);
      next.has(groupKey) ? next.delete(groupKey) : next.add(groupKey);
      return next;
    });
  };

  const toggleGroupFull = (groupKey) => {
    setExpandedGroupsFull((prev) => {
      const next = new Set(prev);
      next.has(groupKey) ? next.delete(groupKey) : next.add(groupKey);
      return next;
    });
  };

  const colCount = roles.length;
  const gridCols = `minmax(280px,1fr) repeat(${colCount},140px) 110px`;
  const minWidthPx = 280 + colCount * 140 + 110;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: (g.items || []).filter(
          (it) =>
            String(it.key || "").toLowerCase().includes(q) ||
            String(it.label || "").toLowerCase().includes(q) ||
            String(g.group || "").toLowerCase().includes(q)
        ),
      }))
      .filter((g) => (g.items || []).length > 0 || compactView);
  }, [groups, query, compactView]);

  useEffect(() => {
    if (!compactView) {
      const all = new Set(filtered.map((g, i) => (g.group ? g.group : `g-${i}`)));
      if (expandedGroupsFull.size === 0 || [...expandedGroupsFull].some((k) => !all.has(k))) {
        setExpandedGroupsFull(all);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compactView, filtered]);

  if (loading) return <div className="p-6 text-neutral-300">Cargando permisos…</div>;

  const btnDark =
    "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium " +
    "bg-neutral-900/70 text-neutral-100 border border-white/10 " +
    "hover:bg-neutral-900/90 transition backdrop-blur-sm";

  const btnPrimary =
    "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold " +
    "bg-emerald-600 text-white border border-emerald-500/80 " +
    "hover:bg-emerald-500 transition shadow";

  return (
    <div className="space-y-4 layer-content">
      {errorMsg && (
        <div className="rounded-xl border border-rose-400/60 bg-rose-500/10 text-rose-100 px-4 py-3 backdrop-blur-sm">
          {errorMsg}
        </div>
      )}

      {banner && (
        <div
          className={
            "rounded-xl px-4 py-3 border backdrop-blur-sm " +
            (banner.type === "ok"
              ? "bg-emerald-500/10 text-emerald-100 border-emerald-400/60"
              : banner.type === "warn"
              ? "bg-sky-500/10 text-sky-100 border-sky-400/60"
              : "bg-rose-500/10 text-rose-100 border-rose-400/60")
          }
        >
          {banner.msg}
        </div>
      )}

      <div className="fx-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por clave, etiqueta o módulo…"
            className="input-fx"
            aria-label="Buscar permisos"
          />
          <div className="flex gap-2 flex-wrap justify-end">
            <button onClick={() => setOpenCreate(true)} className={btnDark} type="button">
              <Plus className="w-4 h-4 opacity-90" />
              <span>Crear permiso</span>
            </button>

            <button
              onClick={() => {
                setCompactView(false);
                const all = new Set(filtered.map((g, i) => (g.group ? g.group : `g-${i}`)));
                setExpandedGroupsFull(all);
              }}
              className={btnDark}
              type="button"
            >
              <Eye className="w-4 h-4 opacity-90" />
              <span>Mostrar</span>
            </button>

            <button
              onClick={() => {
                setCompactView(true);
                setExpandedGroupsCompact(new Set());
                if (scrollRef.current) scrollRef.current.scrollTop = 0;
              }}
              className={btnDark}
              type="button"
            >
              <Minus className="w-4 h-4 opacity-90" />
              <span>Ver menos</span>
            </button>

            <button
              onClick={onSaveAll}
              className={btnPrimary}
              type="button"
              disabled={saving}
            >
              <Square className="w-4 h-4 opacity-95" />
              <span>{saving ? "Guardando..." : "Guardar"}</span>
            </button>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-6 text-neutral-400">No se encontraron permisos para “{query}”.</div>
      ) : compactView ? (
        <div className="fx-card p-0 overflow-hidden">
          <div className="overflow-auto max-h-[72vh]" ref={scrollRef}>
            <div style={{ minWidth: `${minWidthPx}px` }}>
              <div className="sticky top-0 z-20">
                <div className="bg-neutral-950/80 border-b border-neutral-800 backdrop-blur-md">
                  <HeaderRow roles={roles} gridCols={gridCols} />
                </div>
              </div>

              <div className="divide-y divide-neutral-200/40 dark:divide-neutral-800/70">
                {filtered.map((g, idx) => {
                  const groupKey = g.group || `g-${idx}`;
                  const isOpen = expandedGroupsCompact.has(groupKey);

                  return (
                    <div key={`${groupKey}-${idx}`} className="bg-neutral-900/20">
                      <button
                        type="button"
                        onClick={() => toggleGroupCompact(groupKey)}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition"
                      >
                        <div className="flex items-center gap-3">
                          {!isOpen && (
                            <>
                              <span className="font-semibold capitalize text-neutral-100">{g.group}</span>
                              <span className="text-xs font-bold rounded-md px-2 py-0.5 bg-blue-500/20 text-blue-200">
                                {g.items.length}
                              </span>
                            </>
                          )}
                        </div>
                        <span className={`i-lucide:chevron-down transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </button>

                      {isOpen && (
                        <div className="divide-y divide-neutral-800/70">
                          <GroupSection
                            group={g}
                            roles={roles}
                            gridCols={gridCols}
                            roleMatrix={roleMatrix}
                            origMatrix={origMatrix}
                            onToggle={onToggle}
                            onDelete={(it) => setOpenDelete({ id: it._id, key: it.key, label: it.label })}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="fx-card p-0">
          <div ref={scrollRef} className="overflow-auto max-h-[72vh]">
            <div style={{ minWidth: `${minWidthPx}px` }}>
              <div className="sticky top-0 z-20">
                <div className="bg-neutral-950/80 border-b border-neutral-800 backdrop-blur-md">
                  <HeaderRow roles={roles} gridCols={gridCols} />
                </div>
              </div>

              <div className="divide-y divide-neutral-800/70">
                {filtered.map((g, idx) => {
                  const groupKey = g.group || `g-${idx}`;
                  const isOpen = expandedGroupsFull.has(groupKey);

                  return (
                    <div key={`${groupKey}-${idx}`}>
                      <button
                        type="button"
                        onClick={() => toggleGroupFull(groupKey)}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition"
                      >
                        <div className="flex items-center gap-3">
                          {!isOpen && (
                            <>
                              <span className="font-semibold capitalize text-neutral-100">{g.group}</span>
                              <span className="text-xs font-bold rounded-md px-2 py-0.5 bg-blue-500/20 text-blue-200">
                                {g.items.length}
                              </span>
                            </>
                          )}
                        </div>
                        <span className={`i-lucide:chevron-down transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </button>

                      {isOpen && (
                        <GroupSection
                          group={g}
                          roles={roles}
                          gridCols={gridCols}
                          roleMatrix={roleMatrix}
                          origMatrix={origMatrix}
                          onToggle={onToggle}
                          onDelete={(it) => setOpenDelete({ id: it._id, key: it.key, label: it.label })}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <Modal
        open={openCreate}
        title="Crear permiso"
        onClose={() => setOpenCreate(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpenCreate(false)} className={btnDark} type="button">
              Cancelar
            </button>
            <button
              onClick={async () => {
                const ok = await onCreatePerm(form);
                if (ok) {
                  setOpenCreate(false);
                  setForm({ key: "", label: "", moduleValue: "bitacora" });
                }
              }}
              className={btnPrimary}
              type="button"
            >
              Crear
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-sm mb-1 opacity-80">Clave</label>
            <input
              className="input-fx"
              value={form.key}
              onChange={(e) => setForm((p) => ({ ...p, key: e.target.value }))}
              placeholder="modulo.recurso.accion"
            />
          </div>
          <div>
            <label className="block text-sm mb-1 opacity-80">Etiqueta</label>
            <input
              className="input-fx"
              value={form.label}
              onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
              placeholder="Módulo • Acción"
            />
          </div>
          <div>
            <label className="block text-sm mb-1 opacity-80">Módulo</label>
            <select
              className="input-fx"
              value={form.moduleValue}
              onChange={(e) => setForm((p) => ({ ...p, moduleValue: e.target.value }))}
            >
              <option value="bitacora">Bitácora</option>
              <option value="accesos">Control de Acceso</option>
              <option value="iam">IAM</option>
              <option value="incidentes">Incidentes</option>
              <option value="rondasqr">Rondas QR</option>
              <option value="visitas">Visitas</option>
              <option value="reportes">Reportes</option>
              <option value="general">General</option>
            </select>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!openDelete}
        title="Eliminar permiso"
        onClose={() => setOpenDelete(null)}
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpenDelete(null)} className={btnDark} type="button">
              Cancelar
            </button>
            <button
              onClick={async () => {
                await onDeletePerm(openDelete);
                setOpenDelete(null);
              }}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 transition border border-rose-500 shadow"
              type="button"
            >
              Eliminar
            </button>
          </div>
        }
      >
        {openDelete && (
          <p className="text-sm">
            ¿Seguro que deseas eliminar <span className="font-semibold">{openDelete.label}</span>?
            <br />
            <span className="font-mono opacity-80">{openDelete.key}</span>
          </p>
        )}
      </Modal>
    </div>
  );
}