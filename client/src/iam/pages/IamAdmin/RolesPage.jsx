// client/src/iam/pages/IamAdmin/RolesPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { iamApi } from "../../api/iamApi";
import RoleCloneDialog from "./RoleCloneDialog";
import AuditPanel from "./AuditPanel";

// Normalización / fallback del catálogo
import {
  normalizePermsResponse,
  fallbackGroupsFromLocal,
} from "../../lib/permUtils.js";

// 👉 Los 5 roles que quieres usar en el sistema (código estable + etiqueta de UI)
const DISPLAY_ROLES = [
  { code: "admin",          name: "Administrador" },
  { code: "supervisor",     name: "Supervisor" },
  { code: "guardia",        name: "Guardia" },
  { code: "ti",             name: "Administrador IT" },
  { code: "visita_externa", name: "Visita Externa" },
];

// Mapa rápido: code -> label
const CODE_TO_LABEL = Object.fromEntries(DISPLAY_ROLES.map(r => [r.code, r.name]));

/** Obtiene label visible para un rol */
function roleLabel(r) {
  const code = String(r.code || "").toLowerCase();
  return CODE_TO_LABEL[code] || r.name || r.code || "(sin nombre)";
}

export default function RolesPage() {
  const [roles, setRoles] = useState([]);         // [{_id, code, name, description, permissions: []}]
  const [groups, setGroups] = useState([]);       // [{group, items:[{_id,key,label,order,group}]}]
  const [roleId, setRoleId] = useState(null);

  const [working, setWorking] = useState(false);
  const [msg, setMsg] = useState("");
  const [cloneOpen, setCloneOpen] = useState(false);

  async function loadAll() {
    const [rPerms, rRoles] = await Promise.all([
      iamApi.listPerms(),
      iamApi.listRoles(),
    ]);

    // ---- Permisos (normalizados + fallback local si vacío)
    let gs = normalizePermsResponse(rPerms);
    const totalPerms = gs.reduce((acc, g) => acc + (g.items?.length || 0), 0);
    if (totalPerms === 0) gs = fallbackGroupsFromLocal();
    setGroups(gs);

    // ---- Roles
    const items = rRoles?.items || rRoles?.roles || [];
    setRoles(items);

    // Seleccionar por defecto: admin si existe; si no, el primero
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
  const selectedPerms = useMemo(
    () => new Set(selected?.permissions || []),
    [selected]
  );

  function togglePerm(key, on) {
    if (!selected) return;
    const next = new Set(selected.permissions || []);
    if (on) next.add(key); else next.delete(key);
    setRoles(rs =>
      rs.map(r => (r._id === selected._id ? { ...r, permissions: [...next] } : r))
    );
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
      // reload opcional para refrescar desde servidor
      await loadAll();
    } catch (e) {
      setMsg(e?.message || "Error al guardar");
    } finally {
      setWorking(false);
      setTimeout(() => setMsg(""), 2500);
    }
  }

  // Verifica que existan SOLO los 5 roles base (si falta alguno, lo crea)
  async function ensureDisplayRoles() {
    setWorking(true); setMsg("");
    try {
      const cur = await iamApi.listRoles();
      const existingCodes = new Set(
        (cur.items || cur.roles || []).map(r => String(r.code || "").toLowerCase())
      );

      for (const r of DISPLAY_ROLES) {
        if (!existingCodes.has(r.code)) {
          await iamApi.createRole({
            code: r.code,
            name: r.name,
            description: r.name,
            permissions: [], // inicial sin permisos
          });
        }
      }

      await loadAll();
      setMsg("Roles base verificados/creados.");
    } catch (e) {
      setMsg(e?.message || "No se pudieron crear/verificar roles");
    } finally {
      setWorking(false);
      setTimeout(() => setMsg(""), 2500);
    }
  }

  return (
    <div className="space-y-6">
      {/* Barra superior: selector + acciones */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <div className="flex-1">
          <select
            value={roleId || ""}
            onChange={(e) => setRoleId(e.target.value)}
            className="w-full px-3 py-2 rounded border bg-white/70 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
          >
            <option value="" disabled>Selecciona un rol…</option>
            {roles.map(r => (
              <option key={r._id} value={r._id}>{roleLabel(r)}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setCloneOpen(true)}
            className="px-3 py-2 rounded bg-indigo-600 text-white"
          >
            Clonar rol
          </button>

          <button
            onClick={ensureDisplayRoles}
            className="px-3 py-2 rounded bg-sky-600 text-white"
            disabled={working}
          >
            Verificar/crear roles base
          </button>

          <button
            onClick={save}
            className="px-3 py-2 rounded bg-black text-white disabled:opacity-60"
            disabled={!selected || working}
          >
            {working ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>

      {msg && <div className="text-sm text-green-600 dark:text-green-400">{msg}</div>}

      {/* Matriz de permisos por grupo */}
      {!selected ? (
        <div className="p-4 text-gray-500 dark:text-gray-400">
          Selecciona un rol para editar sus permisos.
        </div>
      ) : (
        <div className="rounded border dark:border-gray-800 overflow-hidden">
          {groups.map((g, idx) => (
            <details key={g.group || idx} open>
              <summary className="bg-gray-100 dark:bg-gray-800 px-4 py-3 font-semibold cursor-pointer text-gray-900 dark:text-gray-100">
                {g.group} <span className="opacity-60">({g.items?.length || 0})</span>
              </summary>
              <div className="bg-white dark:bg-gray-900 p-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                {(g.items || []).map(it => {
                  const checked = selectedPerms.has("*") || selectedPerms.has(it.key);
                  return (
                    <label
                      key={it._id || it.key}
                      className="flex items-start gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 mt-1"
                        checked={checked}
                        onChange={e => togglePerm(it.key, e.target.checked)}
                      />
                      <div>
                        <div className="font-mono text-xs text-gray-800 dark:text-gray-200 break-all">
                          {it.key}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {it.label}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </details>
          ))}
        </div>
      )}

      {/* Auditoría */}
      <div className="space-y-2">
        <h4 className="font-semibold text-gray-900 dark:text-gray-100">Histórico (auditoría)</h4>
        <AuditPanel />
      </div>

      {/* Modal de clonado */}
      <RoleCloneDialog
        open={cloneOpen}
        onClose={() => setCloneOpen(false)}
        roles={roles}
        onCloned={() => loadAll()}
      />
    </div>
  );
}
