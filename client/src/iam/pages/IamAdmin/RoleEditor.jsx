// client/src/iam/pages/IamAdmin/RoleEditor.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { iamApi } from "../../api/iamApi.js";

// Pon esto en true si tu backend entiende el comodín "*"
const BACKEND_SUPPORTS_WILDCARD = true;

export default function RoleEditor({ role, perms, onChanged }) {
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [msg, setMsg] = useState("");

  const [form, setForm] = useState(() => ({
    _id: role?._id || null,
    code: role?.code || "",
    name: role?.name || "",
    description: role?.description || "",
    permissions: Array.isArray(role?.permissions) ? role.permissions : [],
  }));

  // ✅ Si cambias de rol (o lo recargas), sincroniza el form
  useEffect(() => {
    setForm({
      _id: role?._id || null,
      code: role?.code || "",
      name: role?.name || "",
      description: role?.description || "",
      permissions: Array.isArray(role?.permissions) ? role.permissions : [],
    });

    lastGranularRef.current = (role?.permissions || []).filter((k) => k !== "*");
  }, [role?._id]); // intencional: rehidratar solo cuando cambia el rol

  // Guarda el último set de permisos "granulares" para restaurarlo al desactivar "*"
  const lastGranularRef = useRef((role?.permissions || []).filter((k) => k !== "*"));

  // Todas las keys disponibles (para expandir * si el backend no lo soporta)
  const allKeys = useMemo(
    () =>
      (perms || [])
        .map((p) => p?.key)
        .filter(Boolean)
        .sort((a, b) => String(a).localeCompare(String(b))),
    [perms]
  );

  // Agrupar permisos por módulo
  const groups = useMemo(() => {
    const map = new Map();
    (perms || []).forEach((p) => {
      const g = p?.group || "General";
      if (!map.has(g)) map.set(g, []);
      map.get(g).push(p);
    });

    return [...map.entries()]
      .map(([group, items]) => ({
        group,
        items: items
          .slice()
          .sort(
            (a, b) =>
              (Number.isFinite(a?.order) ? a.order : 0) -
                (Number.isFinite(b?.order) ? b.order : 0) ||
              String(a?.label || "").localeCompare(String(b?.label || "")) ||
              String(a?.key || "").localeCompare(String(b?.key || ""))
          ),
      }))
      .sort((a, b) => String(a.group).localeCompare(String(b.group)));
  }, [perms]);

  const hasAll = (form.permissions || []).includes("*");
  const has = (key) => (form.permissions || []).includes(key);

  const setPerms = (next) => setForm((f) => ({ ...f, permissions: next }));

  const toggle = (key) => {
    if (!key) return;
    if (hasAll) return; // con "*" activo, no se pueden cambiar individuales

    const set = new Set(form.permissions || []);
    set.has(key) ? set.delete(key) : set.add(key);

    const arr = [...set].filter(Boolean);
    setPerms(arr);
    lastGranularRef.current = arr;
  };

  const selectGroup = (group, turnOn) => {
    if (hasAll) return;

    const keys = (groups.find((g) => g.group === group)?.items || [])
      .map((i) => i?.key)
      .filter(Boolean);

    const set = new Set(form.permissions || []);
    keys.forEach((k) => (turnOn ? set.add(k) : set.delete(k)));

    const arr = [...set].filter(Boolean);
    setPerms(arr);
    lastGranularRef.current = arr;
  };

  const toggleAllSwitch = (on) => {
    if (on) {
      // Guarda el snapshot granular y activa "*"
      lastGranularRef.current = (form.permissions || []).filter((k) => k && k !== "*");
      setPerms(["*"]);
    } else {
      // Restaura el snapshot granular
      const restored = lastGranularRef.current.length ? lastGranularRef.current : [];
      setPerms(restored);
    }
  };

  const buildCodeFromName = (name) =>
    String(name || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");

  const save = async () => {
    if (saving) return;

    const name = String(form.name || "").trim();
    if (!name) {
      setMsg("El nombre del rol es requerido.");
      setTimeout(() => setMsg(""), 2200);
      return;
    }

    setSaving(true);
    setMsg("");

    try {
      let permissions = Array.isArray(form.permissions) ? form.permissions : [];

      // Si tu backend NO soporta "*", expándelo a todas las keys aquí
      if (!BACKEND_SUPPORTS_WILDCARD && permissions.includes("*")) {
        permissions = allKeys;
      }

      // Limpieza defensiva
      permissions = [...new Set(permissions)].filter(Boolean);

      // code: preferir form.code, fallback a role.code, fallback a derivado de name
      let code = String(form.code || role?.code || "").trim();
      if (!code) code = buildCodeFromName(name);

      const payload = {
        code,
        name,
        description: String(form.description || "").trim(),
        permissions,
      };

      if (form._id) await iamApi.updateRole(form._id, payload);
      else await iamApi.createRole(payload);

      setMsg("Guardado.");
      onChanged?.();
    } catch (e) {
      setMsg(e?.message || "Error al guardar");
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 2200);
    }
  };

  const remove = async () => {
    if (!form._id) return;
    if (removing) return;
    if (!window.confirm("¿Eliminar rol?")) return;

    setRemoving(true);
    setMsg("");

    try {
      await iamApi.deleteRole(form._id);
      setMsg("Eliminado.");
      onChanged?.();
    } catch (e) {
      setMsg(e?.message || "Error al eliminar");
    } finally {
      setRemoving(false);
      setTimeout(() => setMsg(""), 2200);
    }
  };

  return (
    <div className="space-y-4">
      {msg && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
          {msg}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <input
          className="border rounded px-3 py-2"
          placeholder="Nombre del rol"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />

        <textarea
          className="border rounded px-3 py-2"
          placeholder="Descripción"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          rows={2}
        />

        {/* Si quieres mostrar el code, descomenta esto:
        <input
          className="border rounded px-3 py-2 font-mono"
          placeholder="code (opcional)"
          value={form.code}
          onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
        />
        */}
      </div>

      <div className="rounded border p-3 flex items-center justify-between">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={hasAll}
            onChange={(e) => toggleAllSwitch(e.target.checked)}
            disabled={saving || removing}
          />
          <span>Todos los permisos (*)</span>
        </label>
        {hasAll && (
          <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-800">
            Concedido el 100% de permisos — los checks están bloqueados
          </span>
        )}
      </div>

      {/* Matriz por grupos */}
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.group} className="border rounded p-3">
            <div className="flex items-center justify-between">
              <div className="font-medium">{g.group}</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-sm px-2 py-1 rounded bg-gray-200 disabled:opacity-60"
                  onClick={() => selectGroup(g.group, true)}
                  disabled={hasAll || saving || removing}
                >
                  Seleccionar todo
                </button>
                <button
                  type="button"
                  className="text-sm px-2 py-1 rounded bg-gray-200 disabled:opacity-60"
                  onClick={() => selectGroup(g.group, false)}
                  disabled={hasAll || saving || removing}
                >
                  Quitar todo
                </button>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
              {g.items.map((p) => (
                <label
                  key={p?._id || p?.key}
                  className={`flex items-center gap-2 border rounded px-2 py-2 ${
                    hasAll ? "opacity-60" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={hasAll ? true : has(p?.key)}
                    onChange={() => toggle(p?.key)}
                    disabled={hasAll || saving || removing}
                  />
                  <span className="text-sm">{p?.label || p?.key}</span>
                  <span className="text-[10px] text-gray-500 ml-auto font-mono">
                    {p?.key}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        {form._id && (
          <button
            className="px-3 py-2 rounded bg-red-600 text-white disabled:opacity-60"
            onClick={remove}
            disabled={saving || removing}
          >
            {removing ? "Eliminando..." : "Eliminar"}
          </button>
        )}
        <button
          className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
          onClick={save}
          disabled={saving || removing}
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}