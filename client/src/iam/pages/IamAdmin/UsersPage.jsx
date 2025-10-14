// client/src/iam/pages/IamAdmin/UsersPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { iamApi } from "../../api/iamApi.js";

const DISPLAY_ROLES = [
  "Administrador",
  "Supervisor",
  "Guardia",
  "Administrador IT",
  "Visita Externa",
];

/** Mapa UI -> nombre de rol en backend */
const ROLE_MAP_UI_TO_DB = {
  "Administrador": "admin",
  "Supervisor": "supervisor",
  "Guardia": "guardia",
  "Administrador IT": "ti",
  "Visita Externa": "visitante",
};

/** Reverso para mostrar bonito si vienen abreviados */
const ROLE_MAP_DB_TO_UI = Object.fromEntries(
  Object.entries(ROLE_MAP_UI_TO_DB).map(([ui, db]) => [db, ui])
);

function RoleBadges({ roles = [] }) {
  const uiNames = roles.map((r) => ROLE_MAP_DB_TO_UI[r] || r);
  return (
    <div className="flex flex-wrap gap-1">
      {uiNames.length === 0 ? (
        <span className="text-neutral-500">—</span>
      ) : (
        uiNames.map((r, i) => (
          <span
            key={`${r}-${i}`}
            className="text-xs px-2 py-1 rounded bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-100"
          >
            {r}
          </span>
        ))
      )}
    </div>
  );
}

function RoleSelect({ value = [], onChange }) {
  const [open, setOpen] = useState(false);
  const selected = new Set(value.map((v) => ROLE_MAP_DB_TO_UI[v] || v));

  const toggle = (uiName) => {
    const copy = new Set(selected);
    if (copy.has(uiName)) copy.delete(uiName);
    else copy.add(uiName);
    const dbList = Array.from(copy).map((ui) => ROLE_MAP_UI_TO_DB[ui] || ui);
    onChange(dbList);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-3 py-2 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-left"
      >
        {selected.size === 0 ? "Seleccionar rol(es)" : Array.from(selected).join(", ")}
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-full max-h-60 overflow-auto rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 shadow">
          {DISPLAY_ROLES.map((ui) => (
            <label
              key={ui}
              className="flex items-center gap-2 px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-700"
            >
              <input
                type="checkbox"
                className="scale-110"
                checked={selected.has(ui)}
                onChange={() => toggle(ui)}
              />
              <span>{ui}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

const ESTADOS_CIVILES = ["Soltero/a", "Casado/a", "Divorciado/a", "Viudo/a", "Unión libre"];

export default function UsersPage() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [onlyActive, setOnlyActive] = useState(true); // filtro “Solo activos”
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // formulario (sin pedir id_persona; lo asigna el backend)
  const empty = {
    // PERSONALES
    nombreCompleto: "",
    tipoDni: "Identidad",
    dni: "",
    estadoCivil: "",
    fechaNacimiento: "",
    paisNacimiento: "",
    ciudadNacimiento: "",
    municipioNacimiento: "",
    correoPersona: "",
    profesion: "",
    lugarTrabajo: "",
    telefono: "",
    domicilio: "",
    // IAM
    roles: [],
    active: true,
  };
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null); // _id del que edito

  async function load() {
    try {
      setLoading(true);
      setErr("");
      const res = await iamApi.listUsers("");
      setItems(res.items || []);
    } catch (e) {
      setErr(e?.message || "Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    let res = items;

    if (t) {
      res = res.filter(
        (u) =>
          (u.nombreCompleto || u.name || "").toLowerCase().includes(t) ||
          (u.correoPersona || "").toLowerCase().includes(t) ||
          (u.dni || "").toLowerCase().includes(t) ||
          String(u.id_persona || "").toLowerCase().includes(t)
      );
    }

    if (onlyActive) {
      res = res.filter((u) => u.active !== false);
    }

    return res;
  }, [items, q, onlyActive]);

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function validate() {
    const e = {};
    if (!form.nombreCompleto) e.nombreCompleto = "Nombre completo requerido";
    if (!form.dni) e.dni = "Documento requerido";
    if (form.correoPersona && !/^\S+@\S+\.\S+$/.test(form.correoPersona)) e.correoPersona = "Correo inválido";
    if (form.telefono && !/^[\d\+\-\s]{7,20}$/.test(form.telefono)) e.telefono = "Teléfono inválido";
    return e;
  }
  const [errors, setErrors] = useState({});

  async function handleSubmit(e) {
    e.preventDefault();
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length) return;

    try {
      const payload = { ...form }; // no se envía id_persona
      if (editing) await iamApi.updateUser(editing, payload);
      else await iamApi.createUser(payload);

      setForm(empty);
      setEditing(null);
      await load();
    } catch (e) {
      alert(e?.message || "Error al guardar");
    }
  }

  async function toggleActive(u) {
    try {
      if (u.active === false) await iamApi.enableUser(u._id);
      else await iamApi.disableUser(u._id);
      await load();
    } catch (e) {
      alert(e?.message || "No se pudo cambiar el estado");
    }
  }

  function startEdit(u) {
    setEditing(u._id);
    setForm({
      nombreCompleto: u.nombreCompleto || "",
      tipoDni: u.tipoDni || "Identidad",
      dni: u.dni || "",
      estadoCivil: u.estadoCivil || "",
      fechaNacimiento: (u.fechaNacimiento || "").slice?.(0, 10) || "",
      paisNacimiento: u.paisNacimiento || "",
      ciudadNacimiento: u.ciudadNacimiento || "",
      municipioNacimiento: u.municipioNacimiento || "",
      correoPersona: u.correoPersona || "",
      profesion: u.profesion || "",
      lugarTrabajo: u.lugarTrabajo || "",
      telefono: u.telefono || "",
      domicilio: u.domicilio || "",
      active: u.active !== false,
      roles: Array.isArray(u.roles) ? u.roles : [],
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditing(null);
    setForm(empty);
    setErrors({});
  }

  // eliminar usuario (soft delete)
  async function handleDelete(u) {
    const nombre = u?.nombreCompleto || u?.name || "este usuario";
    const ok = window.confirm(`¿Seguro que deseas eliminar a ${nombre}? Esta acción no se puede deshacer.`);
    if (!ok) return;

    // Optimista: quitar de la lista al instante
    const prev = items;
    setItems((curr) => curr.filter((x) => x._id !== u._id));

    try {
      await iamApi.deleteUser(u._id); // apunta a /disable en iamApi actual
      if (editing === u._id) cancelEdit();
      // NO hacemos load() para que no reaparezca como inactivo
      alert("Usuario eliminado correctamente.");
    } catch (e) {
      // Revertir si falló
      setItems(prev);
      alert(e?.message || "No se pudo eliminar el usuario");
    }
  }

  return (
    <div className="space-y-6">
      {/* Formulario */}
      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-4 bg-white dark:bg-neutral-900 space-y-3"
      >
        <h3 className="font-semibold text-lg">{editing ? "Editar usuario" : "Crear usuario"}</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* PERSONALES */}
          <Field
            label="Nombre completo"
            name="nombreCompleto"
            value={form.nombreCompleto}
            onChange={setField}
            error={errors.nombreCompleto}
          />

          <div className="md:col-span-2">
            <span className="text-sm">Documento</span>
            <div className="flex gap-2 mt-1">
              <select
                className="px-3 py-2 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800"
                value={form.tipoDni}
                onChange={(e) => setField("tipoDni", e.target.value)}
              >
                <option>Identidad</option>
                <option>Pasaporte</option>
              </select>
              <input
                className="flex-1 px-3 py-2 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800"
                value={form.dni}
                onChange={(e) => setField("dni", e.target.value)}
                placeholder="0801-0000-00000"
              />
            </div>
            {errors.dni && <p className="text-red-500 text-sm mt-1">{errors.dni}</p>}
          </div>

          <Select
            label="Estado civil"
            name="estadoCivil"
            value={form.estadoCivil}
            onChange={setField}
            options={ESTADOS_CIVILES}
          />
          <Field
            type="date"
            label="Fecha de nacimiento"
            name="fechaNacimiento"
            value={form.fechaNacimiento}
            onChange={setField}
          />

          <Field label="País nacimiento" name="paisNacimiento" value={form.paisNacimiento} onChange={setField} />
          <Field label="Ciudad nacimiento" name="ciudadNacimiento" value={form.ciudadNacimiento} onChange={setField} />
          <Field
            label="Municipio nacimiento"
            name="municipioNacimiento"
            value={form.municipioNacimiento}
            onChange={setField}
          />

          <Field
            label="Correo de la persona"
            name="correoPersona"
            value={form.correoPersona}
            onChange={setField}
            error={errors.correoPersona}
          />
          <Field label="Profesión u oficio" name="profesion" value={form.profesion} onChange={setField} />
          <Field label="Dónde labora" name="lugarTrabajo" value={form.lugarTrabajo} onChange={setField} />
          <Field
            label="Teléfono"
            name="telefono"
            value={form.telefono}
            onChange={setField}
            placeholder="+504 9999-9999"
            error={errors.telefono}
          />
          <Field className="md:col-span-2" label="Domicilio actual" name="domicilio" value={form.domicilio} onChange={setField} />

          {/* IAM: solo roles */}
          <label className="space-y-1 md:col-span-2">
            <span className="text-sm">Rol del usuario</span>
            <RoleSelect value={form.roles} onChange={(rolesDb) => setField("roles", rolesDb)} />
          </label>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={!!form.active} onChange={(e) => setField("active", e.target.checked)} />
            <span>Activo</span>
          </label>

          <div className="flex gap-2">
            {editing && (
              <button
                type="button"
                onClick={cancelEdit}
                className="px-3 py-2 rounded border border-neutral-300 dark:border-neutral-600"
              >
                Cancelar
              </button>
            )}
            <button type="submit" className="px-4 py-2 rounded bg-black text-white dark:bg-white dark:text-black">
              {editing ? "Guardar cambios" : "Crear"}
            </button>
          </div>
        </div>
      </form>

      {/* Buscador */}
      <div className="flex items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por ID, nombre, correo personal o DNI…"
          className="w-full px-3 py-2 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800"
        />
        {/* Toggle Solo activos */}
        <label className="flex items-center gap-2 text-sm select-none">
          <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />
          Solo activos
        </label>
      </div>

      {/* Lista / Resumen de usuarios creados */}
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
        <div className="grid grid-cols-12 gap-2 bg-neutral-100 dark:bg-neutral-800 px-3 py-2 font-semibold text-sm">
          <div className="col-span-4">Usuario</div>
          <div className="col-span-4">Roles</div>
          <div className="col-span-2">Estado</div>
          <div className="col-span-2 text-right">Acciones</div>
        </div>

        {loading ? (
          <div className="p-4">Cargando…</div>
        ) : err ? (
          <div className="p-4 text-red-600">{err}</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-neutral-500">Sin usuarios.</div>
        ) : (
          filtered.map((u) => (
            <div
              key={u._id}
              className="grid grid-cols-12 gap-2 px-3 py-3 border-t border-neutral-200 dark:border-neutral-700"
            >
              <div className="col-span-4">
                <div className="font-medium">{u.nombreCompleto || u.name || "—"}</div>

                {/* Muestra SOLO aquí el ID Persona como chip */}
                {u.id_persona != null && (
                  <div className="mt-1">
                    <span className="text-[11px] px-2 py-0.5 rounded bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-100">
                      ID: {u.id_persona}
                    </span>
                  </div>
                )}

                <div className="text-sm text-neutral-500 mt-1">{u.correoPersona || "—"}</div>
                {u.dni && <div className="text-xs text-neutral-500">DNI: {u.dni}</div>}
              </div>

              <div className="col-span-4">
                <RoleBadges roles={u.roles} />
              </div>

              <div className="col-span-2">
                {u.active === false ? (
                  <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200">
                    Inactivo
                  </span>
                ) : (
                  <span className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
                    Activo
                  </span>
                )}
              </div>

              <div className="col-span-2 flex items-center justify-end gap-2">
                <button
                  onClick={() => startEdit(u)}
                  className="px-3 py-1 rounded border border-neutral-300 dark:border-neutral-600"
                >
                  Editar
                </button>
                <button
                  onClick={() => toggleActive(u)}
                  className={`px-3 py-1 rounded ${
                    u.active === false
                      ? "bg-emerald-600 text-white"
                      : "bg-neutral-800 text-white dark:bg-neutral-200 dark:text-black"
                  }`}
                >
                  {u.active === false ? "Activar" : "Desactivar"}
                </button>

                {/* Botón Eliminar con ícono */}
                <button
                  onClick={() => handleDelete(u)}
                  className="p-2 rounded bg-red-600 text-white hover:bg-red-700"
                  title="Eliminar usuario"
                  aria-label="Eliminar usuario"
                >
                  <span aria-hidden="true">🗑️</span>
                  <span className="sr-only">Eliminar</span>
                </button>
                {/* FIN botón */}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Field({ label, name, value, onChange, type = "text", className = "", error, placeholder }) {
  return (
    <label className={`space-y-1 ${className}`}>
      <span className="text-sm">{label}</span>
      <input
        type={type}
        className="w-full px-3 py-2 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(name, e.target.value)}
      />
      {error && <span className="text-xs text-red-500">{error}</span>}
    </label>
  );
}

function Select({ label, name, value, onChange, options = [] }) {
  return (
    <label className="space-y-1">
      <span className="text-sm">{label}</span>
      <select
        className="w-full px-3 py-2 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800"
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
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
