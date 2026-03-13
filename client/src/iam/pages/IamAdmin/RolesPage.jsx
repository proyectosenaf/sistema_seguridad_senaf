import React, { useEffect, useMemo, useState } from "react";
import { iamApi } from "../../api/iamApi.js";
import RoleCloneDialog from "./RoleCloneDialog.jsx";
import {
  PlusCircle,
  Edit3,
  Trash2,
  Save,
  RefreshCw,
  ShieldCheck,
  ChevronDown,
  Copy,
} from "lucide-react";

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

function roleLabel(r) {
  const name = String(r?.name || "").trim();
  const code = String(r?.code || "").trim();
  return name || code || "(sin nombre)";
}

function asListPayload(x) {
  if (!x) return [];
  if (Array.isArray(x)) return x;
  return x.items || x.roles || x.data || [];
}

function normalizePermKey(v) {
  return String(v || "").trim().toLowerCase();
}

function normalizePermList(list = []) {
  const arr = Array.isArray(list) ? list : [];
  return [...new Set(arr.map(normalizePermKey).filter(Boolean))];
}

export default function RolesPage() {
  const [roles, setRoles] = useState([]);
  const [roleId, setRoleId] = useState(null);
  const [working, setWorking] = useState(false);
  const [msg, setMsg] = useState("");
  const [cloneOpen, setCloneOpen] = useState(false);

  const [permItems, setPermItems] = useState([]);
  const [permLoading, setPermLoading] = useState(false);

  async function loadAll() {
    const rRoles = await iamApi.listRoles();
    const items = asListPayload(rRoles);
    setRoles(items);

    const pick =
      items.find((x) => String(x.code || "").toLowerCase() === "admin")?._id ||
      items.find((x) => String(x.name || "").toLowerCase() === "admin")?._id ||
      items.find((x) => String(x.code || "").toLowerCase() === "administrador")?._id ||
      items.find((x) => String(x.name || "").toLowerCase() === "administrador")?._id ||
      items[0]?._id ||
      null;

    setRoleId((v) => v || pick);
  }

  async function loadPermsForRole(id) {
    if (!id) {
      setPermItems([]);
      return;
    }

    setPermLoading(true);
    try {
      const [rolePermsRes, allPermsRes] = await Promise.all([
        iamApi.listPermsForRole(id),
        iamApi.listPerms({}),
      ]);

      const selectedKeys = normalizePermList(
        rolePermsRes?.permissionKeys ||
          rolePermsRes?.permissions ||
          rolePermsRes?.items ||
          []
      );

      const selectedSet = new Set(selectedKeys);

      const allPerms = asListPayload(allPermsRes)
        .map((p) => ({
          ...p,
          key: normalizePermKey(p?.key),
          label: String(p?.label || "").trim(),
          group: String(p?.group || "general").trim(),
          order: Number.isFinite(Number(p?.order)) ? Number(p.order) : 0,
          selected: selectedSet.has(normalizePermKey(p?.key)),
        }))
        .filter((p) => p.key);

      allPerms.sort((a, b) => {
        const g = String(a.group || "").localeCompare(String(b.group || ""));
        if (g !== 0) return g;

        const ao = Number(a.order || 0);
        const bo = Number(b.order || 0);
        if (ao !== bo) return ao - bo;

        return String(a.key || "").localeCompare(String(b.key || ""));
      });

      setPermItems(allPerms);
    } catch (e) {
      setPermItems([]);
      setMsg(e?.message || "Error al cargar permisos");
      setTimeout(() => setMsg(""), 2200);
    } finally {
      setPermLoading(false);
    }
  }

  useEffect(() => {
    loadAll().catch((e) => setMsg(e?.message || "Error al cargar"));
  }, []);

  useEffect(() => {
    loadPermsForRole(roleId);
  }, [roleId]);

  const selected = roles.find((r) => r._id === roleId) || null;

  const rolePermSummary = useMemo(() => {
    if (!permItems || permItems.length === 0) return { count: 0, byGroup: [] };

    const byGroupMap = new Map();
    let total = 0;

    for (const p of permItems) {
      if (!p?.selected) continue;
      const g = String(p.group || "General");
      if (!byGroupMap.has(g)) byGroupMap.set(g, []);
      byGroupMap.get(g).push({
        key: p.key,
        label: p.label,
        group: g,
      });
      total++;
    }

    const groups = [...byGroupMap.entries()]
      .map(([group, items]) => ({
        group,
        items: items.sort((a, b) => String(a.label).localeCompare(String(b.label))),
      }))
      .sort((a, b) => String(a.group).localeCompare(String(b.group)));

    return { count: total, byGroup: groups };
  }, [permItems]);

  async function save() {
    if (!selected) return;
    setWorking(true);
    setMsg("");
    try {
      const permissions = normalizePermList(
        permItems.filter((p) => p.selected).map((p) => p.key)
      );

      if (typeof iamApi.updateRolePermissions === "function") {
        await iamApi.updateRolePermissions(selected._id, { permissions });
      } else if (typeof iamApi.setRolePerms === "function") {
        await iamApi.setRolePerms(selected._id, permissions);
      } else {
        await iamApi.updateRole(selected._id, {
          name: selected.name,
          description: selected.description,
          permissions,
        });
      }

      await loadAll();
      await loadPermsForRole(selected._id);

      setMsg("Cambios guardados.");
    } catch (e) {
      setMsg(e?.message || "Error al guardar");
    } finally {
      setWorking(false);
      setTimeout(() => setMsg(""), 2200);
    }
  }

  async function createRole() {
    try {
      const name = window.prompt("Nombre del nuevo rol:");
      if (!name) return;

      const code = name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, "");

      setWorking(true);
      await iamApi.createRole({
        code: code || undefined,
        key: code || undefined,
        name,
        description: name,
      });

      await loadAll();
      setMsg("Rol creado.");
      setTimeout(() => setMsg(""), 2000);
    } catch (e) {
      setMsg(e?.message || "No se pudo crear el rol");
      setTimeout(() => setMsg(""), 2200);
    } finally {
      setWorking(false);
    }
  }

  async function editRole() {
    if (!selected) return;
    try {
      const newName = window.prompt("Nuevo nombre del rol:", selected.name || "");
      if (!newName) return;
      const newDesc =
        window.prompt("Nueva descripción:", selected.description || newName) ?? selected.description;

      setWorking(true);
      await iamApi.updateRole(selected._id, {
        name: newName,
        description: newDesc,
      });

      await loadAll();
      await loadPermsForRole(selected._id);

      setMsg("Rol actualizado.");
      setTimeout(() => setMsg(""), 2000);
    } catch (e) {
      setMsg(e?.message || "No se pudo editar el rol");
      setTimeout(() => setMsg(""), 2200);
    } finally {
      setWorking(false);
    }
  }

  async function deleteRole() {
    if (!selected) return;
    try {
      if (!window.confirm(`¿Eliminar el rol "${roleLabel(selected)}"?`)) return;

      setWorking(true);
      await iamApi.deleteRole(selected._id);

      await loadAll();
      setMsg("Rol eliminado.");
      setTimeout(() => setMsg(""), 2000);
    } catch (e) {
      setMsg(e?.message || "No se pudo eliminar el rol");
      setTimeout(() => setMsg(""), 2200);
    } finally {
      setWorking(false);
    }
  }

  const refreshPermCatalog = () => loadPermsForRole(roleId);

  return (
    <section className="space-y-6">
      <div className="relative overflow-hidden rounded-[24px] p-5" style={sxCard()}>
        <div className="pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-cyan-500/15 blur-3xl" />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex-1">
            <div className="flex items-center gap-2" style={{ color: "#7dd3fc" }}>
              <ShieldCheck className="h-5 w-5" />
              <span className="text-xs uppercase tracking-wider font-semibold">
                Gestión de roles
              </span>
            </div>

            <div className="mt-2">
              <label
                className="text-xs uppercase tracking-wide"
                style={{ color: "var(--text-muted)" }}
              >
                Rol
              </label>

              <div className="relative">
                <ChevronDown
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4"
                  style={{ color: "var(--text-muted)" }}
                />
                <select
                  value={roleId || ""}
                  onChange={(e) => setRoleId(e.target.value)}
                  className="w-full appearance-none rounded-[16px] pl-3 pr-9 py-2 outline-none transition"
                  style={sxInput()}
                >
                  <option value="" disabled>
                    Selecciona un rol…
                  </option>
                  {roles.map((r) => (
                    <option key={r._id} value={r._id}>
                      {roleLabel(r)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={createRole}
              title="Crear nuevo rol"
              disabled={working}
              className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm transition disabled:opacity-50"
              style={sxSuccessBtn({ borderRadius: "9999px" })}
            >
              <PlusCircle className="h-4 w-4" />
              <span className="font-medium">Crear</span>
            </button>

            <button
              onClick={() => setCloneOpen(true)}
              title="Clonar rol"
              disabled={!selected || working}
              className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm transition disabled:opacity-50"
              style={sxPrimaryBtn({ borderRadius: "9999px" })}
            >
              <Copy className="h-4 w-4" />
              <span className="font-medium">Clonar</span>
            </button>

            <button
              onClick={editRole}
              title="Editar rol"
              disabled={!selected || working}
              className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm transition disabled:opacity-50"
              style={sxGhostBtn({ borderRadius: "9999px" })}
            >
              <Edit3 className="h-4 w-4" />
              <span className="font-medium">Editar</span>
            </button>

            <button
              onClick={deleteRole}
              title="Eliminar rol"
              disabled={!selected || working}
              className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm transition disabled:opacity-50"
              style={sxDangerBtn({ borderRadius: "9999px" })}
            >
              <Trash2 className="h-4 w-4" />
              <span className="font-medium">Eliminar</span>
            </button>

            <button
              onClick={save}
              title="Guardar cambios"
              disabled={!selected || working}
              className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm transition disabled:opacity-50"
              style={sxGhostBtn({ borderRadius: "9999px" })}
            >
              <Save className="h-4 w-4" />
              <span className="font-medium">Guardar</span>
            </button>
          </div>
        </div>

        {msg && (
          <div
            className="mt-4 inline-flex items-center gap-2 rounded-xl px-3 py-2"
            style={{
              background: "color-mix(in srgb, #22c55e 10%, transparent)",
              border: "1px solid color-mix(in srgb, #22c55e 28%, transparent)",
              color: "#bbf7d0",
            }}
          >
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-sm">{msg}</span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-semibold" style={{ color: "var(--text)" }}>
            Permisos del rol seleccionado
          </h4>
          <button
            onClick={refreshPermCatalog}
            disabled={!roleId || permLoading}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition disabled:opacity-60"
            style={sxGhostBtn()}
            title="Volver a leer permisos desde el servidor"
          >
            <RefreshCw className={`h-4 w-4 ${permLoading ? "animate-spin" : ""}`} />
            Refrescar
          </button>
        </div>

        <div className="overflow-hidden rounded-[24px]" style={sxCard()}>
          {!roleId ? (
            <div className="p-6 text-sm" style={{ color: "var(--text-muted)" }}>
              Selecciona un rol para ver sus permisos.
            </div>
          ) : permLoading ? (
            <div className="p-6 text-sm" style={{ color: "var(--text-muted)" }}>
              Cargando…
            </div>
          ) : rolePermSummary.count === 0 ? (
            <div className="p-6 text-sm" style={{ color: "var(--text-muted)" }}>
              Este rol no tiene permisos asignados.
            </div>
          ) : (
            <>
              <div
                className="flex items-center justify-between px-5 py-3"
                style={{
                  background:
                    "linear-gradient(to right, color-mix(in srgb, var(--card-solid) 90%, transparent), color-mix(in srgb, #2563eb 10%, var(--card-solid)))",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  Total permisos
                </div>
                <div
                  className="rounded-full px-3 py-1 text-xs font-bold"
                  style={{
                    background: "#2563eb",
                    color: "#fff",
                    boxShadow: "0 10px 20px color-mix(in srgb, #2563eb 22%, transparent)",
                  }}
                >
                  {rolePermSummary.count}
                </div>
              </div>

              <div style={{ borderTop: "0" }}>
                {rolePermSummary.byGroup.map((g, idx) => (
                  <div
                    key={g.group}
                    className="p-4 sm:p-5"
                    style={{
                      borderTop: idx === 0 ? "0" : "1px solid var(--border)",
                    }}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className="inline-flex h-6 w-6 items-center justify-center rounded-xl"
                        style={{
                          background: "color-mix(in srgb, #2563eb 14%, transparent)",
                          color: "#93c5fd",
                        }}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </span>
                      <span className="font-semibold" style={{ color: "var(--text)" }}>
                        {g.group}
                      </span>
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-semibold"
                        style={{
                          background: "color-mix(in srgb, #2563eb 10%, transparent)",
                          color: "#93c5fd",
                        }}
                      >
                        {g.items.length}
                      </span>
                    </div>

                    <ul className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {g.items.map((it) => (
                        <li
                          key={it.key}
                          className="group flex items-center gap-2 rounded-[18px] px-3 py-2 transition"
                          style={sxCardSoft()}
                        >
                          <span className="inline-block h-1.5 w-1.5 flex-none rounded-full bg-indigo-500 group-hover:scale-125 transition" />
                          <span
                            className="font-mono text-[11px] leading-5 truncate"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {it.key}
                          </span>
                          <span className="text-sm" style={{ color: "var(--text)" }}>
                            — {it.label}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <RoleCloneDialog
        open={cloneOpen}
        onClose={() => setCloneOpen(false)}
        roles={roles}
        onCloned={() => {
          loadAll();
          loadPermsForRole(roleId);
        }}
      />
    </section>
  );
}