// client/src/iam/pages/IamAdmin/UserEditor.jsx
import React, { useEffect, useMemo, useState } from "react";
import { iamApi } from "../../api/iamApi.js";

// ✅ Token canónico central (senaf_token -> token)
import { getToken as getTokenCanonical } from "../../../lib/api.js";

const DISABLE_AUTH = import.meta.env.VITE_DISABLE_AUTH === "1";

/* ========================= Helpers ========================= */

function toDateInputSafe(raw) {
  if (!raw) return "";
  try {
    if (typeof raw === "string") return raw.slice(0, 10);
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function pick(obj, ...paths) {
  for (const path of paths) {
    if (!path) continue;
    const seg = String(path).split(".");
    let v = obj;
    for (const k of seg) {
      if (v == null) break;
      v = v[k];
    }
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return "";
}

function uniqLower(arr) {
  return [
    ...new Set(
      (arr || [])
        .filter(Boolean)
        .map((x) => String(x).trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
}

function mapUserToForm(u = {}) {
  const roles = Array.isArray(u.roles) ? u.roles : u.roles ? [u.roles] : [];
  return {
    nombreCompleto: pick(u, "nombreCompleto", "name", "persona.nombreCompleto") || "",
    tipoDni: pick(u, "tipoDni", "persona.tipoDni") || "Identidad",
    dni: pick(u, "dni", "persona.dni") || "",
    estadoCivil: pick(u, "estadoCivil", "persona.estadoCivil") || "",
    fechaNacimiento: toDateInputSafe(pick(u, "fechaNacimiento", "persona.fechaNacimiento")),
    paisNacimiento: pick(u, "paisNacimiento", "persona.pais") || "",
    ciudadNacimiento: pick(u, "ciudadNacimiento", "persona.ciudad") || "",
    municipio: pick(u, "municipio", "persona.municipio") || "",
    email: pick(u, "email", "persona.correo") || "",
    profesion: pick(u, "profesion", "persona.ocupacion") || "",
    lugarTrabajo: pick(u, "lugarTrabajo", "persona.lugar_trabajo") || "",
    telefono: pick(u, "telefono", "persona.telefono") || "",
    domicilio: pick(u, "domicilio", "persona.direccion") || "",
    roles: uniqLower(roles),
    active: u.active !== false,
  };
}

function normalizeCatalogResponse(r) {
  // admite: {items:[...]}, {data:[...]}, [...] o {catalog:[...]}
  if (Array.isArray(r)) return r;
  if (Array.isArray(r?.items)) return r.items;
  if (Array.isArray(r?.data)) return r.data;
  if (Array.isArray(r?.catalog)) return r.catalog;
  return [];
}

function requireTokenOrNull() {
  if (DISABLE_AUTH) return null;
  const t = getTokenCanonical();
  return t || null;
}

/**
 * Fetch catálogo desde backend sin depender de iamApi helpers
 * (porque tu iamApi.js todavía no tiene listCivilStatus/getCatalogs)
 */
async function fetchCatalog(path, token) {
  const headers = {
    "Cache-Control": "no-store",
    Pragma: "no-cache",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const r = await fetch(path, { headers, cache: "no-store" });
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    const err = new Error(`${r.status} ${r.statusText}${text ? ` - ${text}` : ""}`);
    err.status = r.status;
    throw err;
  }
  return await r.json().catch(() => null);
}

/* ========================= Component ========================= */

export default function UserEditor({ value, onClose, onSaved }) {
  const [form, setForm] = useState(() => mapUserToForm(value || {}));
  const [saving, setSaving] = useState(false);

  // Catálogos (backend)
  const [rolesCatalog, setRolesCatalog] = useState([]); // [{code,name}]
  const [civilCatalog, setCivilCatalog] = useState([]); // ["Soltero/a", ...]

  const [catalogErr, setCatalogErr] = useState("");

  useEffect(() => {
    setForm(mapUserToForm(value || {}));
  }, [value]);

  useEffect(() => {
    (async () => {
      setCatalogErr("");
      const token = requireTokenOrNull();

      // ✅ Roles reales (con token si aplica)
      const rr = await iamApi.listRoles(token);
      const items = rr?.items || rr?.roles || [];
      setRolesCatalog(
        (items || [])
          .map((r) => ({
            code: String(r?.code || r?.key || r?.name || "").trim().toLowerCase(),
            name: String(r?.name || r?.label || r?.code || "").trim(),
          }))
          .filter((x) => x.code)
      );

      // ✅ Estado civil: usar endpoint real del server
      // /api/iam/v1/catalogos/estado-civil  (ES)
      // /api/iam/v1/catalogos/civil-status  (EN compat)
      let rc = null;
      try {
        rc = await fetchCatalog("/api/iam/v1/catalogos/estado-civil", token);
      } catch {
        rc = await fetchCatalog("/api/iam/v1/catalogos/civil-status", token);
      }

      const civ = normalizeCatalogResponse(rc)
        .map((x) => String(x).trim())
        .filter(Boolean);

      setCivilCatalog(civ);
    })().catch((e) => {
      setRolesCatalog([]);
      setCivilCatalog([]);
      setCatalogErr(e?.message || "No se pudieron cargar catálogos (roles/estado civil).");
    });
  }, []);

  const civilOptions = useMemo(() => civilCatalog, [civilCatalog]);

  function setField(name, v) {
    setForm((prev) => ({ ...prev, [name]: v }));
  }

  async function save() {
    if (saving) return;

    try {
      setSaving(true);

      const token = requireTokenOrNull();
      if (!DISABLE_AUTH && !token) {
        alert("No hay token de sesión. Inicia sesión nuevamente.");
        return;
      }

      const payload = {
        ...form,
        email: String(form.email || "").trim().toLowerCase(),
        roles: uniqLower(form.roles),
      };

      // si estadoCivil viene vacío o no existe en catálogo, lo enviamos vacío
      // (backend valida)
      if (civilOptions.length > 0 && payload.estadoCivil) {
        const ok = civilOptions.includes(payload.estadoCivil);
        if (!ok) payload.estadoCivil = "";
      }

      if (value?._id) await iamApi.updateUser(value._id, payload, token);
      else await iamApi.createUser(payload, token);

      onSaved?.();
      onClose?.();
    } catch (e) {
      alert(e?.message || "No se pudo guardar el usuario");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white dark:bg-neutral-950 w-[720px] max-w-[95vw] rounded-2xl p-5 space-y-4 shadow-2xl">
        <div className="text-lg font-semibold">
          {value?._id ? "Editar usuario" : "Nuevo usuario"}
        </div>

        {catalogErr ? (
          <div className="text-sm text-amber-600 dark:text-amber-300 bg-amber-100/50 dark:bg-amber-500/10 border border-amber-400/30 rounded-xl px-3 py-2">
            ⚠️ {catalogErr}
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field
            label="Nombre completo"
            value={form.nombreCompleto}
            onChange={(v) => setField("nombreCompleto", v)}
          />

          <Field
            label="Correo electrónico"
            value={form.email}
            onChange={(v) => setField("email", v)}
          />

          <Select
            label="Estado civil"
            value={form.estadoCivil}
            onChange={(v) => setField("estadoCivil", v)}
            options={civilOptions}
            placeholder={civilOptions.length ? "Seleccionar" : "Catálogo no disponible"}
            disabled={!civilOptions.length}
          />

          <Field
            label="Teléfono"
            value={form.telefono}
            onChange={(v) => setField("telefono", v)}
          />

          {/* Roles dinámicos (sin quemar) */}
          <div className="md:col-span-2">
            <div className="text-sm mb-1">Roles</div>

            {!rolesCatalog.length ? (
              <div className="text-sm text-slate-500">Catálogo de roles no disponible.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {rolesCatalog.map((r) => {
                  const on = form.roles.includes(r.code);
                  return (
                    <button
                      key={r.code}
                      type="button"
                      className={`text-sm px-3 py-1.5 rounded-full border ${
                        on ? "bg-neutral-900 text-white" : "bg-white text-neutral-800"
                      }`}
                      onClick={() => {
                        const set = new Set(form.roles);
                        on ? set.delete(r.code) : set.add(r.code);
                        setField("roles", [...set]);
                      }}
                    >
                      {r.name || r.code}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setField("active", e.target.checked)}
            />
            Activo
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button className="px-3 py-2 bg-gray-200 rounded" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="px-4 py-2 bg-cyan-600 text-white rounded disabled:opacity-60"
            onClick={save}
            disabled={saving}
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }) {
  return (
    <label className="space-y-1">
      <div className="text-sm">{label}</div>
      <input
        type={type}
        className="w-full px-3 py-2 rounded-xl border"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Select({ label, value, onChange, options = [], placeholder = "Seleccionar", disabled = false }) {
  return (
    <label className="space-y-1">
      <div className="text-sm">{label}</div>
      <select
        className="w-full px-3 py-2 rounded-xl border"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}