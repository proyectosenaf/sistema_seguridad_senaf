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

  // Guarda el último set de permisos "granulares" para restaurarlo al desactivar "*"
  const lastGranularRef = useRef(
    (role?.permissions || []).filter((key) => key !== "*")
  );

  // ✅ Si cambias de rol (o lo recargas), sincroniza el form
  useEffect(() => {
    setForm({
      _id: role?._id || null,
      code: role?.code || "",
      name: role?.name || "",
      description: role?.description || "",
      permissions: Array.isArray(role?.permissions) ? role.permissions : [],
    });

    lastGranularRef.current = (role?.permissions || []).filter(
      (key) => key !== "*"
    );
  }, [role?._id, role?.code, role?.name, role?.description, role?.permissions]);

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
      const groupName = p?.group || "General";
      if (!map.has(groupName)) map.set(groupName, []);
      map.get(groupName).push(p);
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

  const setPerms = (next) =>
    setForm((prev) => ({ ...prev, permissions: next }));

  const toggle = (key) => {
    if (!key) return;
    if (hasAll) return; // con "*" activo, no se pueden cambiar individuales

    const nextSet = new Set(form.permissions || []);
    if (nextSet.has(key)) nextSet.delete(key);
    else nextSet.add(key);

    const nextPermissions = [...nextSet].filter(Boolean);
    setPerms(nextPermissions);
    lastGranularRef.current = nextPermissions;
  };

  const selectGroup = (group, turnOn) => {
    if (hasAll) return;

    const keys = (groups.find((g) => g.group === group)?.items || [])
      .map((item) => item?.key)
      .filter(Boolean);

    const nextSet = new Set(form.permissions || []);
    keys.forEach((key) => {
      if (turnOn) nextSet.add(key);
      else nextSet.delete(key);
    });

    const nextPermissions = [...nextSet].filter(Boolean);
    setPerms(nextPermissions);
    lastGranularRef.current = nextPermissions;
  };

  const toggleAllSwitch = (enabled) => {
    if (enabled) {
      // Guarda el snapshot granular y activa "*"
      lastGranularRef.current = (form.permissions || []).filter(
        (key) => key && key !== "*"
      );
      setPerms(["*"]);
      return;
    }

    // Restaura el snapshot granular
    const restored = lastGranularRef.current.length
      ? lastGranularRef.current
      : [];
    setPerms(restored);
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

      if (form._id) {
        await iamApi.updateRole(form._id, payload);
      } else {
        await iamApi.createRole(payload);
      }

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
    if (!form._id || removing) return;
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
      {msg ? (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
          {msg}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <input
          className="rounded border px-3 py-2"
          placeholder="Nombre del rol"
          value={form.name}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, name: e.target.value }))
          }
        />

        <textarea
          className="rounded border px-3 py-2"
          placeholder="Descripción"
          value={form.description}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, description: e.target.value }))
          }
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

      <div className="flex items-center justify-between rounded border p-3">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={hasAll}
            onChange={(e) => toggleAllSwitch(e.target.checked)}
            disabled={saving || removing}
          />
          <span>Todos los permisos (*)</span>
        </label>

        {hasAll ? (
          <span className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-800">
            Concedido el 100% de permisos — los checks están bloqueados
          </span>
        ) : null}
      </div>

      {/* Matriz por grupos */}
      <div className="space-y-4">
        {groups.map((groupItem) => (
          <div key={groupItem.group} className="rounded border p-3">
            <div className="flex items-center justify-between">
              <div className="font-medium">{groupItem.group}</div>

              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded bg-gray-200 px-2 py-1 text-sm disabled:opacity-60"
                  onClick={() => selectGroup(groupItem.group, true)}
                  disabled={hasAll || saving || removing}
                >
                  Seleccionar todo
                </button>

                <button
                  type="button"
                  className="rounded bg-gray-200 px-2 py-1 text-sm disabled:opacity-60"
                  onClick={() => selectGroup(groupItem.group, false)}
                  disabled={hasAll || saving || removing}
                >
                  Quitar todo
                </button>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              {groupItem.items.map((perm) => (
                <label
                  key={perm?._id || perm?.key}
                  className={`flex items-center gap-2 rounded border px-2 py-2 ${
                    hasAll ? "opacity-60" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={hasAll ? true : has(perm?.key)}
                    onChange={() => toggle(perm?.key)}
                    disabled={hasAll || saving || removing}
                  />

                  <span className="text-sm">{perm?.label || perm?.key}</span>

                  <span className="ml-auto font-mono text-[10px] text-gray-500">
                    {perm?.key}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        {form._id ? (
          <button
            type="button"
            className="rounded bg-red-600 px-3 py-2 text-white disabled:opacity-60"
            onClick={remove}
            disabled={saving || removing}
          >
            {removing ? "Eliminando..." : "Eliminar"}
          </button>
        ) : null}

        <button
          type="button"
          className="rounded bg-blue-600 px-3 py-2 text-white disabled:opacity-60"
          onClick={save}
          disabled={saving || removing}
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}