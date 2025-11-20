// client/src/iam/pages/IamAdmin/UserEditor.jsx
import React, { useEffect, useState } from "react";
import { iamApi } from "../../api/iamApi";

const ESTADOS_CIVILES = [
  "Soltero/a",
  "Casado/a",
  "Divorciado/a",
  "Viudo/a",
  "Unión libre",
];

const ROLE_MAP_UI_TO_DB = {
  Administrador: "admin",
  Supervisor: "supervisor",
  Guardia: "guardia",
  "Administrador IT": "ti",
  "Visita Externa": "visitante",
};

const ROLE_MAP_DB_TO_UI = Object.fromEntries(
  Object.entries(ROLE_MAP_UI_TO_DB).map(([ui, db]) => [db, ui])
);

// Helpers
function toDateInputSafe(raw) {
  if (!raw) return "";
  try {
    if (typeof raw === "string") {
      return raw.slice(0, 10);
    }
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
    const segments = path.split(".");
    let value = obj;
    for (const s of segments) {
      if (value == null) break;
      value = value[s];
    }
    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
    ) {
      return value;
    }
  }
  return "";
}

// Normaliza el objeto de backend a las claves del form de este modal
function mapUserToFormSafe(u = {}) {
  const civil = pick(
    u,
    "estadoCivil",
    "estado_civil",
    "civilStatus",
    "persona.estadoCivil"
  );
  const civilOk = ESTADOS_CIVILES.includes(civil)
    ? civil
    : "";

  return {
    nombreCompleto:
      pick(
        u,
        "nombreCompleto",
        "name",
        "fullName",
        "persona.nombreCompleto"
      ) || "",
    tipoDni:
      pick(u, "tipoDni", "persona.tipoDni") ||
      "Identidad",
    dni:
      pick(
        u,
        "dni",
        "documento",
        "num_documento",
        "persona.dni"
      ) || "",
    estadoCivil: civilOk,
    fechaNacimiento: toDateInputSafe(
      pick(
        u,
        "fechaNacimiento",
        "birthDate",
        "fecha_nacimiento",
        "persona.fechaNacimiento",
        "persona.fnac"
      )
    ),
    paisNacimiento:
      pick(
        u,
        "paisNacimiento",
        "pais_nacimiento",
        "countryOfBirth",
        "persona.pais"
      ) || "",
    ciudadNacimiento:
      pick(
        u,
        "ciudadNacimiento",
        "ciudad_nacimiento",
        "cityOfBirth",
        "persona.ciudad"
      ) || "",
    municipio:
      pick(
        u,
        "municipio",
        "municipioNacimiento",
        "persona.municipio"
      ) || "",
    correoelectrónico:
      pick(
        u,
        "correoelectrónico",
        "correoPersona",
        "email",
        "correo",
        "mail",
        "persona.correo"
      ) || "",
    profesion:
      pick(
        u,
        "profesion",
        "ocupacion",
        "persona.ocupacion"
      ) || "",
    lugarTrabajo:
      pick(
        u,
        "lugarTrabajo",
        "dondeLabora",
        "empresa",
        "persona.lugar_trabajo"
      ) || "",
    telefono:
      pick(
        u,
        "telefono",
        "phone",
        "celular",
        "tel",
        "persona.telefono"
      ) || "",
    domicilio:
      pick(
        u,
        "domicilio",
        "direccion",
        "address",
        "persona.direccion"
      ) || "",
    roles: Array.isArray(u.roles)
      ? u.roles
      : u.roles
      ? [u.roles]
      : [],
    active: u.active !== false,
  };
}

export default function UserEditor({
  value,
  onClose,
  onSaved,
}) {
  const [roles, setRoles] = useState([]); // codes: ["admin","guardia",...]

  // Cargar roles disponibles desde el backend (codes)
  useEffect(() => {
    (async () => {
      try {
        const r = await iamApi.listRoles();
        const items = r?.items || r?.roles || [];
        const codes = items
          .map((it) =>
            typeof it === "string"
              ? it
              : it.code || it.name || it._id
          )
          .filter(Boolean);
        setRoles(codes);
      } catch {
        // fallback por si la API falla
        setRoles([
          "admin",
          "guardia",
          "supervisor",
          "ti",
          "visitante",
        ]);
      }
    })();
  }, []);

  const [form, setForm] = useState(
    mapUserToFormSafe(value || {})
  );

  // Sincroniza el formulario cuando cambia `value`
  useEffect(() => {
    setForm(mapUserToFormSafe(value || {}));
  }, [value]);

  function setField(name, v) {
    setForm((prev) => ({ ...prev, [name]: v }));
  }

  async function save() {
    const payload = { ...form };
    // El backend debe mapear correoelectrónico -> email / correoPersona según tu modelo
    if (value?._id)
      await iamApi.updateUser(value._id, payload);
    else await iamApi.createUser(payload);
    onSaved?.();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-neutral-900 w-[720px] max-w-[95vw] rounded-xl p-5 space-y-4 border border-neutral-200 dark:border-neutral-700">
        <div className="text-lg font-medium">
          {value?._id
            ? "Editar usuario"
            : "Nuevo usuario"}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field
            label="Nombre completo"
            value={form.nombreCompleto}
            onChange={(v) =>
              setField("nombreCompleto", v)
            }
          />

          <div className="md:col-span-2">
            <div className="text-sm">Documento</div>
            <div className="flex gap-2 mt-1">
              <select
                className="px-3 py-2 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800"
                value={form.tipoDni}
                onChange={(e) =>
                  setField("tipoDni", e.target.value)
                }
              >
                <option>Identidad</option>
                <option>Pasaporte</option>
              </select>
              <input
                className="flex-1 px-3 py-2 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800"
                value={form.dni}
                onChange={(e) =>
                  setField("dni", e.target.value)
                }
              />
            </div>
          </div>

          <Select
            label="Estado civil"
            value={form.estadoCivil}
            onChange={(v) =>
              setField("estadoCivil", v)
            }
            options={ESTADOS_CIVILES}
          />
          <Field
            type="date"
            label="Fecha de nacimiento"
            value={form.fechaNacimiento}
            onChange={(v) =>
              setField("fechaNacimiento", v)
            }
          />

          <Field
            label="País nacimiento"
            value={form.paisNacimiento}
            onChange={(v) =>
              setField("paisNacimiento", v)
            }
          />
          <Field
            label="Ciudad nacimiento"
            value={form.ciudadNacimiento}
            onChange={(v) =>
              setField("ciudadNacimiento", v)
            }
          />
          <Field
            label="Municipio"
            value={form.municipio}
            onChange={(v) =>
              setField("municipio", v)
            }
          />

          <Field
            label="Correo electrónico"
            value={form.correoelectrónico}
            onChange={(v) =>
              setField("correoelectrónico", v)
            }
          />
          <Field
            label="Profesión u oficio"
            value={form.profesion}
            onChange={(v) =>
              setField("profesion", v)
            }
          />
          <Field
            label="Lugar de trabajo"
            value={form.lugarTrabajo}
            onChange={(v) =>
              setField("lugarTrabajo", v)
            }
          />
          <Field
            label="Teléfono"
            value={form.telefono}
            onChange={(v) =>
              setField("telefono", v)
            }
          />
          <Field
            className="md:col-span-2"
            label="Domicilio actual"
            value={form.domicilio}
            onChange={(v) =>
              setField("domicilio", v)
            }
          />

          {/* Roles */}
          <div className="md:col-span-2">
            <div className="text-sm mb-1">Roles</div>
            <div className="flex flex-wrap gap-2">
              {roles.map((code) => {
                const on = form.roles?.includes(code);
                const label =
                  ROLE_MAP_DB_TO_UI[code] || code;
                return (
                  <button
                    key={code}
                    type="button"
                    className={`text-sm px-2 py-1 rounded border border-neutral-300 dark:border-neutral-600 ${
                      on
                        ? "bg-black text-white dark:bg-white dark:text-black"
                        : "bg-white dark:bg-neutral-800 text-black dark:text-white"
                    }`}
                    onClick={() => {
                      const set = new Set(
                        form.roles || []
                      );
                      on
                        ? set.delete(code)
                        : set.add(code);
                      setField("roles", [...set]);
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) =>
                setField("active", e.target.checked)
              }
            />
            Activo
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <button
            className="px-3 py-2 rounded bg-gray-200 dark:bg-neutral-800"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            className="px-3 py-2 rounded bg-blue-600 text-white"
            onClick={save}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  className = "",
}) {
  return (
    <label className={`space-y-1 ${className}`}>
      <div className="text-sm">{label}</div>
      <input
        type={type}
        className="w-full px-3 py-2 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800"
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options = [],
}) {
  return (
    <label className="space-y-1">
      <div className="text-sm">{label}</div>
      <select
        className="w-full px-3 py-2 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800"
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
      >
        <option value="">Seleccionar</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
