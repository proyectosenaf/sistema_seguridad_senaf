// client/src/iam/pages/IamAdmin/PermissionCatalog.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { fallbackGroupsFromLocal } from "../../lib/permUtils.js";

/* ──────────────────────────────────────────────────────────────
   Config: columnas de roles y utilidades
   ────────────────────────────────────────────────────────────── */
const ROLE_COLUMNS = [
  { key: "admin",      label: "Administrador" },
  { key: "supervisor", label: "Supervisor" },
  { key: "guard",      label: "Guardia" },
  { key: "admin_it",   label: "Administrador IT" }, // renombrado
  { key: "visitor",    label: "Visita externa" },
];

const emptyRoles = () => ({
  admin: false, supervisor: false, guard: false, admin_it: false, visitor: false,
});
const coerceRoles = (r = {}) => {
  const base = emptyRoles();
  for (const k of Object.keys(base)) base[k] = Boolean(r[k]);
  return base;
};

/* ──────────────────────────────────────────────────────────────
   Canon de módulos permitidos (sin "Reportes") y normalización
   ────────────────────────────────────────────────────────────── */
const MODULES = [
  { value: "bitacora",  label: "Bitácora" },
  { value: "acceso",    label: "Control de Acceso" }, // acceso/accesos/control de acceso
  { value: "evaluacion",label: "Evaluación" },
  { value: "iam",       label: "IAM" },
  { value: "incidentes",label: "Incidentes" },
  { value: "rondas",    label: "Rondas" },
  { value: "supervision", label: "Supervisión" },
  { value: "visitas",   label: "Visitas" },
];

// Mapa para reconocer variantes y llevarlas a la etiqueta canónica
const CANON_MAP = new Map([
  ["bitacora", "Bitácora"], ["bitácora", "Bitácora"],
  ["acceso", "Control de Acceso"], ["accesos", "Control de Acceso"], ["control de acceso", "Control de Acceso"], ["control de accesos", "Control de Acceso"],
  ["evaluacion", "Evaluación"], ["evaluación", "Evaluación"],
  ["iam", "IAM"],
  ["incidentes", "Incidentes"],
  ["rondas", "Rondas"],
  ["supervision", "Supervisión"], ["supervisión", "Supervisión"],
  ["visitas", "Visitas"],
  // "reportes" y derivados quedan intencionalmente fuera (excluir)
]);

const ALLOWED_LABELS = new Set(MODULES.map(m => m.label));

function canonLabel(name = "") {
  const k = String(name).trim().toLowerCase();
  return CANON_MAP.get(k) || null; // null = no permitido (e.g., Reportes)
}

/** Normaliza y fusiona grupos por su etiqueta canónica, excluyendo no permitidos. */
function normalizeAndMergeGroups(rawGroups = []) {
  const bucket = new Map(); // label -> {group:label, items:[]}
  for (const g of rawGroups) {
    const label = canonLabel(g.group);
    if (!label) continue; // descartar grupos no permitidos (p.ej., Reportes)
    for (const it of g.items || []) {
      const entry = bucket.get(label) || { group: label, items: [] };
      entry.items.push({ ...it, group: label });
      bucket.set(label, entry);
    }
  }
  const out = Array.from(bucket.values());
  out.forEach(gr => gr.items.sort((a, b) => String(a.label).localeCompare(String(b.label))));
  out.sort((a, b) => String(a.group).localeCompare(String(b.group)));
  return out;
}

/* ──────────────────────────────────────────────────────────────
   UI helpers
   ────────────────────────────────────────────────────────────── */
function RoleCheck({ checked, onChange, label }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={!!checked}
        onChange={onChange}
        className="h-4 w-4 rounded border-neutral-400 text-blue-600 focus:ring-blue-500 dark:border-neutral-600"
        aria-label={label}
      />
    </label>
  );
}

function Modal({ open, title, onClose, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-xl fx-card bg-neutral-950/85">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <h3 className="section-title text-lg">{title}</h3>
            <button
              onClick={onClose}
              className="p-2 rounded-md bg-neutral-200 text-neutral-900 hover:brightness-105 dark:bg-neutral-800 dark:text-neutral-100"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
          <div className="px-4 pb-4">{children}</div>
          {footer && <div className="px-4 pb-4">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Persistencia local y helpers de grupos
   ────────────────────────────────────────────────────────────── */
const LS_KEY = "iam_perm_catalog";

function loadFromLS() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // normalizar cualquier dato previo
    if (parsed?.groups) parsed.groups = normalizeAndMergeGroups(parsed.groups);
    return parsed;
  } catch { return null; }
}
function saveToLS(state) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {}
}

function upsertItemInGroups(groups, item) {
  const out = groups.map(g => ({ ...g, items: [...g.items] }));
  const groupName = item.group || "Otros";
  let gi = out.findIndex(g => (g.group || "").toLowerCase() === groupName.toLowerCase());
  if (gi === -1) { out.push({ group: groupName, items: [] }); gi = out.length - 1; }
  const items = out[gi].items;
  const exist = items.findIndex(x => (x.key || x._id) === (item.key || item._id));
  if (exist === -1) items.push(item); else items[exist] = { ...items[exist], ...item };
  items.sort((a, b) => String(a.label).localeCompare(String(b.label)));
  out.sort((a, b) => String(a.group).localeCompare(String(b.group)));
  return out;
}
function removeItemFromGroups(groups, key) {
  const out = groups.map(g => ({ ...g, items: g.items.filter(it => it.key !== key) }));
  return out.filter(g => g.items.length > 0);
}

/* ──────────────────────────────────────────────────────────────
   Componente Principal
   ────────────────────────────────────────────────────────────── */
export default function PermissionCatalog() {
  const [groups, setGroups] = useState([]); // [{ group, items: [{_id,key,label,group,order,roles?}] }]
  const [query, setQuery] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Matrices de roles
  const [roleMatrix, setRoleMatrix] = useState({}); // { [permKey]: roles }
  const [origMatrix, setOrigMatrix] = useState({}); // snapshot para detectar sucios
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState(null);       // {type:'ok'|'warn'|'err', msg}

  // Modales (crear / eliminar)
  const [openCreate, setOpenCreate] = useState(false);
  const [openDelete, setOpenDelete] = useState(null); // {key,label}

  // Form crear
  const [form, setForm] = useState({ key: "", label: "", moduleValue: MODULES[0].value });

  // Vista compacta (Ver menos)
  const [compactView, setCompactView] = useState(false);

  // Debounce buscador
  const tRef = useRef(null);
  useEffect(() => {
    clearTimeout(tRef.current);
    tRef.current = setTimeout(() => setQDebounced(query.trim().toLowerCase()), 200);
    return () => clearTimeout(tRef.current);
  }, [query]);

  // Carga inicial (LS o fallback) con normalización de grupos
  useEffect(() => {
    setLoading(true);
    try {
      const fromLs = loadFromLS();
      if (fromLs?.groups && fromLs?.roleMatrix) {
        setGroups(fromLs.groups);
        setRoleMatrix(fromLs.roleMatrix);
        setOrigMatrix(JSON.parse(JSON.stringify(fromLs.roleMatrix)));
      } else {
        const normalized = normalizeAndMergeGroups(fallbackGroupsFromLocal());
        const m = {};
        for (const g of normalized) for (const it of g.items) m[it.key] = coerceRoles(it.roles);
        setGroups(normalized);
        setRoleMatrix(m);
        setOrigMatrix(JSON.parse(JSON.stringify(m)));
      }
      setErr("");
    } catch (e) {
      setErr("No se pudo cargar el catálogo local.");
      setGroups([]); setRoleMatrix({}); setOrigMatrix({});
    } finally { setLoading(false); }
  }, []);

  // Filtrado (por clave/etiqueta/módulo canónico)
  const filtered = useMemo(() => {
    if (!qDebounced) return groups;
    return groups
      .map(g => ({
        ...g,
        items: g.items.filter(it =>
          String(it.key || "").toLowerCase().includes(qDebounced) ||
          String(it.label || "").toLowerCase().includes(qDebounced) ||
          String(g.group || "").toLowerCase().includes(qDebounced)
        ),
      }))
      .filter(g => g.items.length > 0 || compactView);
  }, [groups, qDebounced, compactView]);

  // Helpers sucios/payload
  const isDirtyKey = (k) => {
    const a = roleMatrix[k] || {};
    const b = origMatrix[k] || {};
    return ROLE_COLUMNS.some(c => Boolean(a[c.key]) !== Boolean(b[c.key]));
  };
  const dirtyPayload = () => {
    const arr = [];
    for (const k of Object.keys(roleMatrix)) if (isDirtyKey(k)) arr.push({ key: k, roles: roleMatrix[k] });
    return arr;
  };

  // Acciones de roles
  const toggleRole = (permKey, roleKey) => {
    setRoleMatrix(prev => {
      const curr = coerceRoles(prev[permKey]);
      return { ...prev, [permKey]: { ...curr, [roleKey]: !curr[roleKey] } };
    });
  };
  const onSaveRoles = () => {
    const changes = dirtyPayload();
    if (changes.length === 0) { setBanner({ type: "warn", msg: "No hay cambios para guardar." }); return; }
    setSaving(true); setBanner(null);
    try {
      const nextOrig = JSON.parse(JSON.stringify(roleMatrix));
      setOrigMatrix(nextOrig);
      saveToLS({ groups, roleMatrix: nextOrig });
      setBanner({ type: "ok", msg: `Cambios guardados (${changes.length}).` });
    } catch {
      setBanner({ type: "err", msg: "No se pudo guardar en almacenamiento local." });
    } finally { setSaving(false); setTimeout(() => setBanner(null), 3000); }
  };

  // Crear
  const openCreateModal = () => {
    setForm({ key: "", label: "", moduleValue: MODULES[0].value });
    setOpenCreate(true);
  };
  const submitCreate = () => {
    const key = form.key.trim();
    const label = form.label.trim();
    const moduleObj = MODULES.find(m => m.value === form.moduleValue) || MODULES[0];
    const group = moduleObj.label; // almacenamos etiqueta canónica
    if (!key || !label) { setBanner({ type: "warn", msg: "Completa clave y etiqueta." }); return; }

    const item = { _id: key, key, label, group, roles: emptyRoles() };
    const nextGroups = upsertItemInGroups(groups, item);
    const nextMatrix = { ...roleMatrix, [key]: emptyRoles() };
    setGroups(nextGroups); setRoleMatrix(nextMatrix);
    setOrigMatrix(o => ({ ...o, [key]: emptyRoles() }));
    saveToLS({ groups: nextGroups, roleMatrix: nextMatrix });
    setOpenCreate(false); setBanner({ type: "ok", msg: "Permiso creado." });
  };

  // Eliminar
  const startDelete = (it) => setOpenDelete({ key: it.key, label: it.label });
  const submitDelete = () => {
    const key = openDelete.key;
    const nextGroups = removeItemFromGroups(groups, key);
    const { [key]: _, ...nextMatrix } = roleMatrix;
    const { [key]: __, ...nextOrig } = origMatrix;
    setGroups(nextGroups); setRoleMatrix(nextMatrix); setOrigMatrix(nextOrig);
    saveToLS({ groups: nextGroups, roleMatrix: nextMatrix });
    setOpenDelete(null); setBanner({ type: "ok", msg: "Permiso eliminado." });
  };

  /* ──────────────────────────────────────────────────────────────
     Mostrar / Ver menos (sin modales)
     ────────────────────────────────────────────────────────────── */
  const expandAll = () => { document.querySelectorAll("details.group").forEach(d => (d.open = true)); };
  const collapseAll = () => { document.querySelectorAll("details.group").forEach(d => (d.open = false)); };
  const onMostrar = () => { setCompactView(false); expandAll(); };
  const onVerMenos = () => { setCompactView(true); collapseAll(); };

  if (loading) return <div className="p-6 text-neutral-700 dark:text-neutral-300">Cargando permisos…</div>;

  return (
    <div className="space-y-4 layer-content">
      {err && <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 p-3">{err}</div>}
      {banner && (
        <div
          className={
            "rounded-md p-3 border " +
            (banner.type === "ok"
              ? "bg-emerald-50 text-emerald-800 border-emerald-300"
              : banner.type === "warn"
              ? "bg-blue-50 text-blue-800 border-blue-300"
              : "bg-rose-50 text-rose-800 border-rose-300")
          }
        >
          {banner.msg}
        </div>
      )}

      {/* Barra superior */}
      <div className="fx-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por clave, etiqueta o módulo…"
            className="input-fx"
            aria-label="Buscar permisos"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={openCreateModal}
              className="px-3 py-2 rounded-lg text-sm bg-neutral-200 text-neutral-900 hover:brightness-105 dark:bg-neutral-800 dark:text-neutral-100"
              title="Crear permiso"
            >
              <span className="inline-flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="opacity-90">
                  <path d="M11 11V5a1 1 0 1 1 2 0v6h6a1 1 0 1 1 0 2h-6v6a1 1 0 1 1-2 0v-6H5a1 1 0 1 1 0-2h6z"/>
                </svg>
                Crear permiso
              </span>
            </button>
            <button
              type="button"
              onClick={onMostrar}
              className="px-3 py-2 rounded-lg text-sm bg-neutral-200 text-neutral-900 hover:brightness-105 dark:bg-neutral-800 dark:text-neutral-100"
              title="Mostrar módulos con permisos"
            >
              <span className="inline-flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="opacity-90">
                  <path d="M12 5c5 0 9 4.5 9 7s-4 7-9 7-9-4.5-9-7 4-7 9-7zm0 2c-3.9 0-7 3.1-7 5s3.1 5 7 5 7-3.1 7-5-3.1-5-7-5zm0 2.5a2.5 2.5 0 110 5 2.5 2.5 0 010-5z"/>
                </svg>
                Mostrar
              </span>
            </button>
            <button
              type="button"
              onClick={onVerMenos}
              className="px-3 py-2 rounded-lg text-sm bg-neutral-200 text-neutral-900 hover:brightness-105 dark:bg-neutral-800 dark:text-neutral-100"
              title="Ver solo módulos"
            >
              <span className="inline-flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="opacity-90">
                  <path d="M19 13H5a1 1 0 110-2h14a1 1 0 110 2z"/>
                </svg>
                Ver menos
              </span>
            </button>
            <button
              type="button"
              onClick={onSaveRoles}
              disabled={saving}
              className="px-3 py-2 rounded-lg text-sm bg-emerald-600 text-white hover:brightness-110 disabled:opacity-60"
              title="Guardar cambios"
            >
              <span className="inline-flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="opacity-90">
                  <path d="M17 3H5a2 2 0 00-2 2v14l4-2h10a2 2 0 002-2V5a2 2 0 00-2-2z"/>
                </svg>
                {saving ? "Guardando…" : "Guardar"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Contenido */}
      {filtered.length === 0 ? (
        <div className="p-6 text-neutral-600 dark:text-neutral-300">No se encontraron permisos para “{query}”.</div>
      ) : compactView ? (
        /* ── Vista compacta: solo módulos ── */
        <div className="fx-card p-0 overflow-hidden">
          <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wide bg-neutral-100/70 dark:bg-neutral-900/70 text-neutral-600 dark:text-neutral-300">
            Permisos
          </div>
          <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {filtered.map((g, idx) => (
              <div key={`${g.group}-${idx}`} className="px-4 py-3 flex items-center gap-3 bg-neutral-100/5 dark:bg-neutral-900/30">
                <span className="inline-flex w-5 h-5 items-center justify-center rounded-md bg-neutral-200/70 dark:bg-neutral-800">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 6l6 6-6 6"/></svg>
                </span>
                <span className="font-semibold capitalize text-neutral-100">{g.group}</span>
                <span className="text-xs font-bold rounded-md px-2 py-0.5 bg-blue-600/15 text-blue-300">{g.items.length}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* ── Vista completa: módulos + permisos ── */
        <div className="fx-card p-0 overflow-hidden">
          {/* Encabezado */}
          <div
            className="
              sticky top-0 z-[1]
              grid items-center
              bg-neutral-100/70 dark:bg-neutral-900/70
              border-b border-neutral-200 dark:border-neutral-800
              px-4 py-3
              text-xs font-semibold uppercase tracking-wide
              text-neutral-600 dark:text-neutral-300
            "
            style={{ gridTemplateColumns: "minmax(280px,1fr) repeat(5,140px) 110px" }}
          >
            <div className="text-neutral-800 dark:text-neutral-100">Permisos</div>
            {ROLE_COLUMNS.map(col => (
              <div key={col.key} className="text-center">{col.label}</div>
            ))}
            <div className="text-center">Acciones</div>
          </div>

          {/* Grupos */}
          <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {filtered.map((g, idx) => (
              <details key={`${g.group}-${idx}`} open className="group">
                <summary
                  className="
                    list-none cursor-pointer select-none
                    px-4 py-3
                    bg-neutral-100 dark:bg-neutral-900
                    text-neutral-900 dark:text-neutral-100
                    border-b border-neutral-200 dark:border-neutral-800
                    flex items-center gap-3
                  "
                >
                  <span className="inline-flex w-5 h-5 items-center justify-center rounded-md bg-neutral-200/70 dark:bg-neutral-800">
                    <svg className="transition-transform duration-200 group-open:rotate-90" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </span>
                  <span className="font-semibold capitalize">{g.group}</span>
                  <span className="text-xs font-bold rounded-md px-2 py-0.5 bg-blue-600/15 text-blue-500 dark:bg-blue-400/15 dark:text-blue-300">
                    {g.items.length}
                  </span>
                </summary>

                {/* Permisos */}
                <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {g.items.map((it) => {
                    const roles = roleMatrix[it.key] || emptyRoles();
                    const dirty = isDirtyKey(it.key);
                    return (
                      <div
                        key={it._id || it.key}
                        className={"grid items-center px-4 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-900/70 " + (dirty ? "ring-1 ring-amber-300/60" : "")}
                        style={{ gridTemplateColumns: "minmax(280px,1fr) repeat(5,140px) 110px" }}
                      >
                        {/* Columna permiso */}
                        <div className="min-w-0">
                          <div className="font-mono text-[11px] md:text-xs text-neutral-500 dark:text-neutral-400 truncate">{it.key}</div>
                          <div className="text-sm text-neutral-100">{it.label}</div>
                        </div>

                        {/* Checkboxes por rol */}
                        {ROLE_COLUMNS.map((col) => (
                          <div key={col.key} className="flex items-center justify-center">
                            <RoleCheck
                              checked={roles[col.key]}
                              onChange={() => toggleRole(it.key, col.key)}
                              label={`${col.label} puede ${it.label}`}
                            />
                          </div>
                        ))}

                        {/* Acciones (solo eliminar) */}
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            title="Eliminar"
                            onClick={() => startDelete(it)}
                            className="p-1.5 rounded-md bg-neutral-200 text-neutral-800 hover:brightness-105 dark:bg-neutral-800 dark:text-neutral-200"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            ))}
          </div>
        </div>
      )}

      {/* ─────────── Modales (crear y eliminar) ─────────── */}
      <Modal
        open={openCreate}
        title="Crear permiso"
        onClose={() => setOpenCreate(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpenCreate(false)} className="px-3 py-2 rounded-lg bg-neutral-200 dark:bg-neutral-800">Cancelar</button>
            <button onClick={submitCreate} className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:brightness-110">Crear</button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-sm mb-1 opacity-80">Clave</label>
            <input
              className="input-fx"
              value={form.key}
              onChange={(e) => setForm(prev => ({ ...prev, key: e.target.value }))}
              placeholder="modulo.accion"
            />
          </div>
          <div>
            <label className="block text-sm mb-1 opacity-80">Etiqueta</label>
            <input
              className="input-fx"
              value={form.label}
              onChange={(e) => setForm(prev => ({ ...prev, label: e.target.value }))}
              placeholder="Módulo · Acción"
            />
          </div>
          <div>
            <label className="block text-sm mb-1 opacity-80">Módulo</label>
            <select
              className="input-fx"
              value={form.moduleValue}
              onChange={(e) => setForm(prev => ({ ...prev, moduleValue: e.target.value }))}
            >
              {MODULES.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
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
            <button onClick={() => setOpenDelete(null)} className="px-3 py-2 rounded-lg bg-neutral-200 dark:bg-neutral-800">Cancelar</button>
            <button onClick={submitDelete} className="px-3 py-2 rounded-lg bg-rose-600 text-white hover:brightness-110">Eliminar</button>
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
