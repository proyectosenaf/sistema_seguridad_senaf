import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";

import HeaderRow from "../components/HeaderRow";
import GroupSection from "../components/GroupSection";
import Modal from "../components/Modal";
import { Plus, Eye, Minus, Square } from "lucide-react";

import { iamApi } from "../../../api/iamApi.js";

/* =========================
   UI helpers
========================= */
function sxCard(extra = {}) {
  return {
    background: "color-mix(in srgb, var(--card) 90%, transparent)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-md)",
    backdropFilter: "blur(12px) saturate(130%)",
    WebkitBackdropFilter: "blur(12px) saturate(130%)",
    ...extra,
  };
}

function sxCardSoft(extra = {}) {
  return {
    background: "color-mix(in srgb, var(--card-solid) 88%, transparent)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-sm)",
    ...extra,
  };
}

function sxInput(extra = {}) {
  return {
    background: "var(--input-bg)",
    color: "var(--text)",
    border: "1px solid var(--input-border)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,.04)",
    ...extra,
  };
}

function sxGhostBtn(extra = {}) {
  return {
    background: "color-mix(in srgb, var(--card-solid) 88%, transparent)",
    color: "var(--text)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-sm)",
    ...extra,
  };
}

function sxPrimaryBtn(extra = {}) {
  return {
    background: "linear-gradient(135deg, #2563eb, #06b6d4)",
    color: "#fff",
    border: "1px solid transparent",
    boxShadow: "0 10px 20px color-mix(in srgb, #2563eb 22%, transparent)",
    ...extra,
  };
}

function sxSuccessBtn(extra = {}) {
  return {
    background: "linear-gradient(135deg, #16a34a, #22c55e)",
    color: "#fff",
    border: "1px solid transparent",
    boxShadow: "0 10px 20px color-mix(in srgb, #16a34a 22%, transparent)",
    ...extra,
  };
}

function sxDangerBtn(extra = {}) {
  return {
    background: "linear-gradient(135deg, #dc2626, #ef4444)",
    color: "#fff",
    border: "1px solid transparent",
    boxShadow: "0 10px 20px color-mix(in srgb, #dc2626 22%, transparent)",
    ...extra,
  };
}

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

function isSameRow(a = {}, b = {}) {
  const ka = Object.keys(a)
    .filter((k) => a[k] === true)
    .map(normalizePermKey)
    .sort();

  const kb = Object.keys(b)
    .filter((k) => b[k] === true)
    .map(normalizePermKey)
    .sort();

  if (ka.length !== kb.length) return false;
  for (let i = 0; i < ka.length; i++) {
    if (ka[i] !== kb[i]) return false;
  }
  return true;
}

/* =========================
   Data inside this file
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
      const [rRes, pRes] = await Promise.all([
        iamApi.listRoles(),
        iamApi.listPerms({}, undefined),
      ]);

      const rolesList = asListPayload(rRes);
      const permsList = asListPayload(pRes);

      const normalizedPerms = permsList
        .map((p) => ({
          ...p,
          key: normalizePermKey(p.key),
          group: String(p.group || groupFromKey(p.key)).toLowerCase(),
        }))
        .filter((p) => p.key);

      const validPermKeys = new Set(normalizedPerms.map((p) => p.key));

      const groupsBuilt =
        Array.isArray(pRes?.groups) && pRes.groups.length
          ? pRes.groups.map((g) => ({
              ...g,
              group: String(g.group || "general").toLowerCase(),
              items: Array.isArray(g.items)
                ? g.items
                    .map((it) => ({
                      ...it,
                      key: normalizePermKey(it.key),
                      group: String(
                        it.group || g.group || groupFromKey(it.key)
                      ).toLowerCase(),
                    }))
                    .filter((it) => validPermKeys.has(it.key))
                : [],
            }))
          : buildGroupsFromPerms(normalizedPerms);

      const matrix = {};

      await Promise.all(
        rolesList.map(async (r) => {
          const rid = roleIdOf(r);
          if (!rid) return;

          try {
            const permRes = await iamApi.listPermsForRole(String(rid));
            const rawKeys = normalizePermList(
              permRes?.permissionKeys ||
                permRes?.permissions ||
                permRes?.items ||
                permRes?.data ||
                []
            );

            const keys = rawKeys.filter((k) => validPermKeys.has(k));

            const row = {};
            for (const k of keys) row[k] = true;
            matrix[String(rid)] = row;
          } catch {
            matrix[String(rid)] = {};
          }
        })
      );

      setRoles(rolesList);
      setGroups(groupsBuilt);
      setRoleMatrix(matrix);
      setOrigMatrix(cloneMatrix(matrix));
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

      const validPermKeys = new Set(
        groups.flatMap((g) =>
          Array.isArray(g.items) ? g.items.map((it) => normalizePermKey(it.key)) : []
        )
      );

      for (const r of roles) {
        const rid = roleIdOf(r);
        if (!rid) continue;

        const rowNow = roleMatrix[String(rid)] || {};
        const rowOrig = origMatrix[String(rid)] || {};

        if (isSameRow(rowNow, rowOrig)) continue;

        const nextPerms = normalizePermList(
          Object.entries(rowNow)
            .filter(([k, v]) => v === true && validPermKeys.has(normalizePermKey(k)))
            .map(([k]) => k)
        );

        if (typeof iamApi.updateRolePermissions === "function") {
          await iamApi.updateRolePermissions(String(rid), { permissions: nextPerms });
        } else if (typeof iamApi.setRolePerms === "function") {
          await iamApi.setRolePerms(String(rid), nextPerms);
        } else {
          await iamApi.updateRole(String(rid), { permissions: nextPerms });
        }
      }

      await loadAll();

      if (typeof onSaved === "function") {
        onSaved();
      }

      setBanner({ type: "ok", msg: "✅ Cambios guardados." });
    } catch (e) {
      const missing = Array.isArray(e?.payload?.missing) ? e.payload.missing.join(", ") : "";
      setBanner({
        type: "err",
        msg:
          e?.message ||
          (missing
            ? `❌ Permisos inexistentes: ${missing}`
            : "❌ Error guardando cambios."),
      });
    } finally {
      setSaving(false);
    }
  }, [roles, roleMatrix, origMatrix, saving, loadAll, onSaved, groups]);

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

        await iamApi.createPerm({ key: keyRaw, label, group, order: 0 });
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
  const [form, setForm] = useState({
    key: "",
    label: "",
    moduleValue: "bitacora",
  });
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
  }, [compactView, filtered, expandedGroupsFull]);

  if (loading) {
    return (
      <div className="p-6 text-sm" style={{ color: "var(--text-muted)" }}>
        Cargando permisos…
      </div>
    );
  }

  return (
    <div className="space-y-4 layer-content">
      {errorMsg && (
        <div
          className="rounded-xl px-4 py-3"
          style={{
            background: "color-mix(in srgb, #ef4444 10%, transparent)",
            border: "1px solid color-mix(in srgb, #ef4444 26%, transparent)",
            color: "#fecaca",
          }}
        >
          {errorMsg}
        </div>
      )}

      {banner && (
        <div
          className="rounded-xl px-4 py-3"
          style={
            banner.type === "ok"
              ? {
                  background: "color-mix(in srgb, #22c55e 10%, transparent)",
                  border: "1px solid color-mix(in srgb, #22c55e 26%, transparent)",
                  color: "#bbf7d0",
                }
              : banner.type === "warn"
              ? {
                  background: "color-mix(in srgb, #3b82f6 10%, transparent)",
                  border: "1px solid color-mix(in srgb, #3b82f6 26%, transparent)",
                  color: "#bfdbfe",
                }
              : {
                  background: "color-mix(in srgb, #ef4444 10%, transparent)",
                  border: "1px solid color-mix(in srgb, #ef4444 26%, transparent)",
                  color: "#fecaca",
                }
          }
        >
          {banner.msg}
        </div>
      )}

      <div className="rounded-[24px] p-4" style={sxCard()}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por clave, etiqueta o módulo…"
            className="w-full sm:max-w-[360px] rounded-xl px-3 py-2 text-sm outline-none"
            style={sxInput()}
            aria-label="Buscar permisos"
          />

          <div className="flex gap-2 flex-wrap justify-end">
            <button
              onClick={() => setOpenCreate(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
              style={sxGhostBtn()}
              type="button"
            >
              <Plus className="w-4 h-4 opacity-90" />
              <span>Crear permiso</span>
            </button>

            <button
              onClick={() => {
                setCompactView(false);
                const all = new Set(filtered.map((g, i) => (g.group ? g.group : `g-${i}`)));
                setExpandedGroupsFull(all);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
              style={sxGhostBtn()}
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
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
              style={sxGhostBtn()}
              type="button"
            >
              <Minus className="w-4 h-4 opacity-90" />
              <span>Ver menos</span>
            </button>

            <button
              onClick={onSaveAll}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-60"
              style={sxSuccessBtn()}
              type="button"
              disabled={saving}
              title={saving ? "Guardando..." : "Guardar cambios"}
            >
              <Square className="w-4 h-4 opacity-95" />
              <span>{saving ? "Guardando..." : "Guardar"}</span>
            </button>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-6 text-sm" style={{ color: "var(--text-muted)" }}>
          No se encontraron permisos para “{query}”.
        </div>
      ) : compactView ? (
        <div className="rounded-[24px] p-0 overflow-hidden" style={sxCard()}>
          <div className="overflow-auto max-h-[72vh]" ref={scrollRef}>
            <div style={{ minWidth: `${minWidthPx}px` }}>
              <div className="sticky top-0 z-20">
                <div
                  className="backdrop-blur-md"
                  style={{
                    background: "color-mix(in srgb, var(--card-solid) 94%, transparent)",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <HeaderRow roles={roles} gridCols={gridCols} />
                </div>
              </div>

              <div style={{ borderTop: "0" }}>
                {filtered.map((g, idx) => {
                  const groupKey = g.group || `g-${idx}`;
                  const isOpen = expandedGroupsCompact.has(groupKey);

                  return (
                    <div
                      key={`${groupKey}-${idx}`}
                      style={{
                        background: "transparent",
                        borderTop: idx === 0 ? "0" : "1px solid var(--border)",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleGroupCompact(groupKey)}
                        className="w-full px-4 py-3 flex items-center justify-between transition"
                      >
                        <div className="flex items-center gap-3">
                          {!isOpen && (
                            <>
                              <span className="font-semibold capitalize" style={{ color: "var(--text)" }}>
                                {g.group}
                              </span>
                              <span
                                className="text-xs font-bold rounded-md px-2 py-0.5"
                                style={{
                                  background: "color-mix(in srgb, #2563eb 12%, transparent)",
                                  color: "#bfdbfe",
                                }}
                              >
                                {g.items.length}
                              </span>
                            </>
                          )}
                        </div>
                        <span
                          className={`i-lucide:chevron-down transition-transform ${isOpen ? "rotate-180" : ""}`}
                          aria-hidden
                          style={{ color: "var(--text-muted)" }}
                        />
                      </button>

                      {isOpen && (
                        <div style={{ borderTop: "1px solid var(--border)" }}>
                          <GroupSection
                            key={`${g.group}-compact`}
                            group={g}
                            roles={roles}
                            gridCols={gridCols}
                            roleMatrix={roleMatrix}
                            origMatrix={origMatrix}
                            onToggle={onToggle}
                            onDelete={(it) =>
                              setOpenDelete({ id: it._id, key: it.key, label: it.label })
                            }
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
        <div className="rounded-[24px] p-0 overflow-hidden" style={sxCard()}>
          <div ref={scrollRef} className="overflow-auto max-h-[72vh]">
            <div style={{ minWidth: `${minWidthPx}px` }}>
              <div className="sticky top-0 z-20">
                <div
                  className="backdrop-blur-md"
                  style={{
                    background: "color-mix(in srgb, var(--card-solid) 94%, transparent)",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <HeaderRow roles={roles} gridCols={gridCols} />
                </div>
              </div>

              <div>
                {filtered.map((g, idx) => {
                  const groupKey = g.group || `g-${idx}`;
                  const isOpen = expandedGroupsFull.has(groupKey);

                  return (
                    <div
                      key={`${groupKey}-${idx}`}
                      style={{
                        borderTop: idx === 0 ? "0" : "1px solid var(--border)",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleGroupFull(groupKey)}
                        className="w-full px-4 py-3 flex items-center justify-between transition"
                        style={{ gridColumn: "1 / -1" }}
                      >
                        <div className="flex items-center gap-3">
                          {!isOpen && (
                            <>
                              <span className="font-semibold capitalize" style={{ color: "var(--text)" }}>
                                {g.group}
                              </span>
                              <span
                                className="text-xs font-bold rounded-md px-2 py-0.5"
                                style={{
                                  background: "color-mix(in srgb, #2563eb 12%, transparent)",
                                  color: "#bfdbfe",
                                }}
                              >
                                {g.items.length}
                              </span>
                            </>
                          )}
                        </div>
                        <span
                          className={`i-lucide:chevron-down transition-transform ${isOpen ? "rotate-180" : ""}`}
                          aria-hidden
                          style={{ color: "var(--text-muted)" }}
                        />
                      </button>

                      {isOpen && (
                        <GroupSection
                          key={`${g.group}-full`}
                          group={g}
                          roles={roles}
                          gridCols={gridCols}
                          roleMatrix={roleMatrix}
                          origMatrix={origMatrix}
                          onToggle={onToggle}
                          onDelete={(it) =>
                            setOpenDelete({ id: it._id, key: it.key, label: it.label })
                          }
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
            <button onClick={() => setOpenCreate(false)} style={sxGhostBtn()} className="px-4 py-2 rounded-xl text-sm font-medium" type="button">
              Cancelar
            </button>
            <button
              onClick={async () => {
                const ok = await onCreatePerm(form);
                if (ok) {
                  setOpenCreate(false);
                  setForm({
                    key: "",
                    label: "",
                    moduleValue: "bitacora",
                  });
                }
              }}
              style={sxSuccessBtn()}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              type="button"
            >
              Crear
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-sm mb-1" style={{ color: "var(--text-muted)" }}>
              Clave
            </label>
            <input
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={sxInput()}
              value={form.key}
              onChange={(e) => setForm((prev) => ({ ...prev, key: e.target.value }))}
              placeholder="modulo.recurso.accion"
            />
          </div>
          <div>
            <label className="block text-sm mb-1" style={{ color: "var(--text-muted)" }}>
              Etiqueta
            </label>
            <input
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={sxInput()}
              value={form.label}
              onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
              placeholder="Módulo · Acción"
            />
          </div>
          <div>
            <label className="block text-sm mb-1" style={{ color: "var(--text-muted)" }}>
              Módulo
            </label>
            <select
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={sxInput()}
              value={form.moduleValue}
              onChange={(e) => setForm((prev) => ({ ...prev, moduleValue: e.target.value }))}
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
            <button onClick={() => setOpenDelete(null)} style={sxGhostBtn()} className="px-4 py-2 rounded-xl text-sm font-medium" type="button">
              Cancelar
            </button>
            <button
              onClick={async () => {
                await onDeletePerm(openDelete);
                setOpenDelete(null);
              }}
              style={sxDangerBtn()}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              type="button"
            >
              Eliminar
            </button>
          </div>
        }
      >
        {openDelete && (
          <p className="text-sm" style={{ color: "var(--text)" }}>
            ¿Seguro que deseas eliminar <span className="font-semibold">{openDelete.label}</span>?
            <br />
            <span className="font-mono" style={{ color: "var(--text-muted)" }}>
              {openDelete.key}
            </span>
          </p>
        )}
      </Modal>
    </div>
  );
}