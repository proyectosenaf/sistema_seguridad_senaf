// client/src/iam/pages/IamAdmin/RolesPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { iamApi } from "../../api/iamApi";
import RoleCloneDialog from "./RoleCloneDialog";
import AuditPanel from "./AuditPanel";
import { PlusCircle, Edit3, Trash2, Save } from "lucide-react"; // íconos modernos

import {
  normalizePermsResponse,
  fallbackGroupsFromLocal,
} from "../../lib/permUtils.js";

const DISPLAY_ROLES = [
  { code: "admin", name: "Administrador" },
  { code: "supervisor", name: "Supervisor" },
  { code: "guardia", name: "Guardia" },
  { code: "ti", name: "Administrador IT" },
  { code: "visita_externa", name: "Visita Externa" },
];

const EXCLUDED_GROUPS = new Set(["accesos", "reportes"]);
const CODE_TO_LABEL = Object.fromEntries(DISPLAY_ROLES.map(r => [r.code, r.name]));

function roleLabel(r) {
  const code = String(r.code || "").toLowerCase();
  return CODE_TO_LABEL[code] || r.name || r.code || "(sin nombre)";
}

export default function RolesPage() {
  const [roles, setRoles] = useState([]);
  const [groups, setGroups] = useState([]);
  const [roleId, setRoleId] = useState(null);
  const [working, setWorking] = useState(false);
  const [msg, setMsg] = useState("");
  const [cloneOpen, setCloneOpen] = useState(false);
  const [query, setQuery] = useState("");

  async function loadAll() {
    const [rPerms, rRoles] = await Promise.all([
      iamApi.listPerms(),
      iamApi.listRoles(),
    ]);

    let gs = normalizePermsResponse(rPerms);
    const totalPerms = gs.reduce((acc, g) => acc + (g.items?.length || 0), 0);
    if (totalPerms === 0) gs = fallbackGroupsFromLocal();

    gs = gs
      .map(g => ({ ...g, group: g.group || "General" }))
      .filter(g => !EXCLUDED_GROUPS.has(String(g.group).toLowerCase()));

    setGroups(gs);

    const items = rRoles?.items || rRoles?.roles || [];
    setRoles(items);

    const adminId =
      items.find(x => (String(x.code || "").toLowerCase() === "admin"))?._id ||
      items.find(x => String(x.name || "").toLowerCase() === "administrador")?._id ||
      items[0]?._id ||
      null;

    setRoleId(v => v || adminId);
  }

  useEffect(() => {
    loadAll().catch(e => setMsg(e?.message || "Error al cargar"));
  }, []);

  const selected = roles.find(r => r._id === roleId) || null;
  const selectedPerms = useMemo(() => new Set(selected?.permissions || []), [selected]);

  function togglePerm(key, on) {
    if (!selected) return;
    const next = new Set(selected.permissions || []);
    if (on) next.add(key); else next.delete(key);
    setRoles(rs => rs.map(r => (r._id === selected._id ? { ...r, permissions: [...next] } : r)));
  }

  async function save() {
    if (!selected) return;
    setWorking(true); setMsg("");
    try {
      await iamApi.updateRole(selected._id, {
        name: selected.name,
        description: selected.description,
        permissions: selected.permissions || [],
      });
      setMsg("Cambios guardados.");
      await loadAll();
    } catch (e) {
      setMsg(e?.message || "Error al guardar");
    } finally {
      setWorking(false);
      setTimeout(() => setMsg(""), 2500);
    }
  }

  async function createRole() {
    try {
      const name = window.prompt("Nombre del nuevo rol:");
      if (!name) return;

      const code = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

      await iamApi.createRole({ code: code || undefined, name, description: name, permissions: [] });
      await loadAll();
      setMsg("Rol creado.");
      setTimeout(() => setMsg(""), 2000);
    } catch (e) {
      setMsg(e?.message || "No se pudo crear el rol");
      setTimeout(() => setMsg(""), 2500);
    }
  }

  async function editRole() {
    if (!selected) return;
    try {
      const newName = window.prompt("Nuevo nombre del rol:", selected.name || "");
      if (!newName) return;
      const newDesc = window.prompt("Nueva descripción:", selected.description || newName) ?? selected.description;

      await iamApi.updateRole(selected._id, {
        name: newName,
        description: newDesc,
        permissions: selected.permissions || [],
      });

      await loadAll();
      setMsg("Rol actualizado.");
      setTimeout(() => setMsg(""), 2000);
    } catch (e) {
      setMsg(e?.message || "No se pudo editar el rol");
      setTimeout(() => setMsg(""), 2500);
    }
  }

  async function deleteRole() {
    if (!selected) return;
    try {
      if (!window.confirm(`¿Eliminar el rol "${selected.name || selected.code}"?`)) return;
      await iamApi.deleteRole(selected._id);
      await loadAll();
      setMsg("Rol eliminado.");
      setTimeout(() => setMsg(""), 2000);
    } catch (e) {
      setMsg(e?.message || "No se pudo eliminar el rol");
      setTimeout(() => setMsg(""), 2500);
    }
  }

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.map(g => ({
      ...g,
      items: (g.items || []).filter(it =>
        String(it.key).toLowerCase().includes(q) ||
        String(it.label || "").toLowerCase().includes(q)
      )
    })).filter(g => (g.items?.length || 0) > 0);
  }, [groups, query]);

  return (
    <section className="space-y-6">
      <div className="bg-gradient-to-r from-sky-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-5">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <div className="flex-1">
            <label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Rol</label>
            <select
              value={roleId || ""}
              onChange={(e) => setRoleId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border bg-white/90 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="" disabled>Selecciona un rol…</option>
              {roles.map(r => (
                <option key={r._id} value={r._id}>{roleLabel(r)}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-3">
            <button onClick={createRole} title="Crear nuevo rol" className="p-2.5 rounded-full bg-green-100 hover:bg-green-200 dark:bg-green-800 dark:hover:bg-green-700 text-green-700 dark:text-green-200 transition">
              <PlusCircle size={20} />
            </button>
            <button onClick={editRole} title="Editar rol" className="p-2.5 rounded-full bg-blue-100 hover:bg-blue-200 dark:bg-blue-800 dark:hover:bg-blue-700 text-blue-700 dark:text-blue-200 transition" disabled={!selected || working}>
              <Edit3 size={20} />
            </button>
            <button onClick={deleteRole} title="Eliminar rol" className="p-2.5 rounded-full bg-rose-100 hover:bg-rose-200 dark:bg-rose-800 dark:hover:bg-rose-700 text-rose-700 dark:text-rose-200 transition" disabled={!selected || working}>
              <Trash2 size={20} />
            </button>
            <button onClick={save} title="Guardar cambios" className="p-2.5 rounded-full bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-800 dark:hover:bg-indigo-700 text-indigo-700 dark:text-indigo-200 transition" disabled={!selected || working}>
              <Save size={20} />
            </button>
          </div>
        </div>

        {msg && <div className="mt-3 text-sm text-green-700 dark:text-green-400">{msg}</div>}

        <div className="mt-3">
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar permisos por clave o etiqueta…"
              className="w-full px-3 py-2 pl-10 rounded-xl border bg-white/90 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          </div>
        </div>
      </div>

      {!selected ? (
        <div className="p-6 text-gray-500 dark:text-gray-400 border border-dashed rounded-2xl">Selecciona un rol para editar sus permisos.</div>
      ) : (
        <div className="rounded-2xl border dark:border-gray-800 overflow-hidden bg-white/70 dark:bg-gray-900/60">
          {filteredGroups.map((g, idx) => (
            <details key={g.group || idx} open className="group">
              <summary className="flex items-center justify-between px-5 py-4 bg-gray-50/80 dark:bg-gray-800/70 text-gray-900 dark:text-gray-100 cursor-pointer select-none">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-indigo-400"></span>
                  <span className="font-semibold">{g.group}</span>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200">{g.items?.length || 0}</span>
              </summary>
              <div className="p-4 lg:p-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {(g.items || []).map(it => {
                  const checked = selectedPerms.has("*") || selectedPerms.has(it.key);
                  return (
                    <label key={it._id || it.key} className={`flex items-start gap-3 p-3 rounded-xl border transition hover:shadow-sm hover:bg-gray-50/70 dark:hover:bg-gray-800/60 ${checked ? "border-indigo-400/60 dark:border-indigo-600/60" : "border-gray-200 dark:border-gray-800"}`}>
                      <input type="checkbox" className="h-4 w-4 mt-1 accent-indigo-500" checked={checked} onChange={e => togglePerm(it.key, e.target.checked)} />
                      <div className="min-w-0">
                        <div className="font-mono text-xs text-gray-800 dark:text-gray-200 break-all">{it.key}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 truncate">{it.label}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </details>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <h4 className="font-semibold text-gray-900 dark:text-gray-100">Histórico (auditoría)</h4>
        <div className="rounded-2xl border dark:border-gray-800 p-3 bg-white/70 dark:bg-gray-900/60">
          <AuditPanel />
        </div>
      </div>

      <RoleCloneDialog open={cloneOpen} onClose={() => setCloneOpen(false)} roles={roles} onCloned={() => loadAll()} />
    </section>
  );
}
