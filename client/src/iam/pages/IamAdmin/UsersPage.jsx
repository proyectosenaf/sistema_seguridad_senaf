// client/src/iam/pages/IamAdmin/UsersPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
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

/* Roles como <select> con flecha (selección simple para mantener compatibilidad) */
function RoleSelect({ value = [], onChange }) {
<<<<<<< HEAD
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
=======
  const selected = value[0] ? (ROLE_MAP_DB_TO_UI[value[0]] || value[0]) : "";

  return (
    <select
      className="w-full px-3 py-2 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800"
      value={selected}
      onChange={(e) => {
        const ui = e.target.value;
        const db = ROLE_MAP_UI_TO_DB[ui] || ui;
        onChange(ui ? [db] : []); // mantiene estructura de arreglo
      }}
    >
      <option value="">Seleccionar</option>
      {DISPLAY_ROLES.map((ui) => (
        <option key={ui} value={ui}>{ui}</option>
      ))}
    </select>
>>>>>>> c92648ee3f5a66fdc180f956f99882d154e2c46c
  );
}

const ESTADOS_CIVILES = ["Soltero/a", "Casado/a", "Divorciado/a", "Viudo/a", "Unión libre"];

/** Reglas de contraseña */
function passwordRules(p = "") {
  return {
    length: p.length >= 8,
    upper: /[A-Z]/.test(p),
    lower: /[a-z]/.test(p),
    digit: /\d/.test(p),
  };
}

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
  const [editing, setEditing] = useState(null); // guarda el _id del usuario en edición

  /** Credenciales */
  const [creds, setCreds] = useState({
    password: "",
    confirm: "",
    sendVerification: false,
  });
  const [showPwd, setShowPwd] = useState(false);

  const [pwdFocused, setPwdFocused] = useState(false);
  const pwdR = passwordRules(creds.password);
  const match = creds.password && creds.confirm && creds.password === creds.confirm;
  const showPwdRules = (creds.password && creds.password.length > 0);

  /** Ref del formulario + ref del primer campo y estado de envío */
  const formRef = useRef(null);
  const firstFieldRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);

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

    const wantsPassword = !!(creds.password || creds.confirm || creds.sendVerification);
    if (wantsPassword) {
      const r = passwordRules(creds.password);
      if (!r.length || !r.upper || !r.lower || !r.digit) {
        e.password = "Debe tener 8+ caracteres, mayúscula, minúscula y número.";
      }
      if (!creds.password || creds.password !== creds.confirm) {
        e.confirm = "La confirmación no coincide.";
      }
      if (creds.sendVerification && !/^\S+@\S+\.\S+$/.test(form.correoPersona || "")) {
        e.correoPersona = "Correo requerido/válido para enviar verificación.";
      }
    }

    return e;
  }
  const [errors, setErrors] = useState({});

  async function handleSubmit(e) {
    e.preventDefault();
    console.log("[UsersPage] submit clicked");

    const v = validate();
    setErrors(v);
    if (Object.keys(v).length) {
      console.warn("[UsersPage] validation blocked submit:", v);
      const firstKey = Object.keys(v)[0];
      if (firstKey) {
        const el = document.querySelector(`[name="${firstKey}"]`);
        el?.focus?.();
      }
      return;
    }

    try {
      setSubmitting(true);
      const payload = { ...form };

      // Adjuntar credenciales si se proporcionaron
      if (creds.password) payload.password = creds.password;
      payload.sendVerification = !!creds.sendVerification;

      let res;
      if (editing) {
        console.log("[UsersPage] updating user:", editing, payload);
        res = await iamApi.updateUser(editing, payload);
        alert("Usuario actualizado correctamente");
      } else {
        console.log("[UsersPage] creating user:", payload);
        res = await iamApi.createUser(payload);
        alert("Usuario creado correctamente ✅");
      }

      console.log("[UsersPage] respuesta backend:", res);

      setForm(empty);
      setEditing(null);
      setCreds({ password: "", confirm: "", sendVerification: false });
      await load();
    } catch (e) {
      console.error("[UsersPage] submit error:", e);
      alert("⚠️ Error al guardar: " + (e?.message || "Revisa la consola para más detalles"));
    } finally {
      setSubmitting(false);
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
    console.log("[UsersPage] entrar a edición:", u);
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
    setCreds({ password: "", confirm: "", sendVerification: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
    // foco en el primer campo para que sea evidente el modo edición
    setTimeout(() => firstFieldRef.current?.focus?.(), 100);
  }

  function cancelEdit() {
    setEditing(null);
    setForm(empty);
    setCreds({ password: "", confirm: "", sendVerification: false });
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
      {/* Aviso de validación (solo tras intento fallido) */}
      {Object.keys(errors).length > 0 && (
        <div className="rounded-md border border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-600 dark:bg-amber-900/20 dark:text-amber-200 px-3 py-2">
          Revisa los campos marcados en rojo.
        </div>
      )}

      {/* Banner de MODO EDICIÓN (solo cuando editing != null) */}
      {editing && (
        <div className="flex items-center justify-between rounded-md border border-sky-400 bg-sky-50 text-sky-900 dark:border-sky-700 dark:bg-sky-900/20 dark:text-sky-200 px-3 py-2">
          <div className="text-sm">
            <span className="font-semibold">Editando usuario</span>
            {form?.nombreCompleto ? `: ${form.nombreCompleto}` : ""} {form?.id_persona ? `(ID: ${form.id_persona})` : ""}
          </div>
          <button
            type="button"
            onClick={cancelEdit}
            className="px-3 py-1 rounded border border-sky-300 dark:border-sky-600"
          >
            Salir del modo edición
          </button>
        </div>
      )}

      {/* Formulario */}
      <form
<<<<<<< HEAD
=======
        ref={formRef}
>>>>>>> c92648ee3f5a66fdc180f956f99882d154e2c46c
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
<<<<<<< HEAD
=======
            required
            inputRef={firstFieldRef} // foco al entrar a editar
>>>>>>> c92648ee3f5a66fdc180f956f99882d154e2c46c
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
                name="dni"
                className="flex-1 px-3 py-2 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800"
                value={form.dni}
                onChange={(e) => setField("dni", e.target.value)}
                placeholder="0801-0000-00000"
                required
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
<<<<<<< HEAD
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
=======
          <Field label="Municipio" name="municipioNacimiento" value={form.municipioNacimiento} onChange={setField} />

          <Field label="Correo electrónico" name="correoPersona" value={form.correoPersona} onChange={setField} error={errors.correoPersona} />
          <Field label="Profesión u oficio" name="profesion" value={form.profesion} onChange={setField} />
          <Field label="Lugar de trabajo" name="lugarTrabajo" value={form.lugarTrabajo} onChange={setField} />
          <Field label="Teléfono" name="telefono" value={form.telefono} onChange={setField} placeholder="+504 9999-9999" error={errors.telefono} />
>>>>>>> c92648ee3f5a66fdc180f956f99882d154e2c46c
          <Field className="md:col-span-2" label="Domicilio actual" name="domicilio" value={form.domicilio} onChange={setField} />

          {/* IAM: Rol del usuario */}
          <label className="space-y-1 md:col-span-2">
            <span className="text-sm">Rol del usuario</span>
            <RoleSelect value={form.roles} onChange={(rolesDb) => setField("roles", rolesDb)} />
          </label>
        </div>

        {/* Credenciales de acceso */}
        <section className="mt-3 space-y-2">
          <h4 className="font-semibold">Credenciales de acceso</h4>

          <label className="space-y-1">
            <span className="text-sm">Contraseña</span>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                className="w-full px-3 py-2 pr-24 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800"
                value={creds.password}
                onChange={(e)=>setCreds(c=>({...c, password: e.target.value}))}
                onFocus={()=>setPwdFocused(true)}
                onBlur={()=>setPwdFocused(!!(creds.password && creds.password.length > 0))}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={()=>setShowPwd(s=>!s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-sm px-2 py-1 rounded bg-neutral-200 dark:bg-neutral-700"
              >
                {showPwd ? "Ocultar" : "Mostrar"}
              </button>
            </div>
            {errors.password && <span className="text-xs text-red-500">{errors.password}</span>}
            {showPwdRules && (
              <ul className="text-xs opacity-80 mt-1 grid grid-cols-2 gap-x-4">
                <li>{pwdR.length ? "✅" : "❌"} Mínimo 8 caracteres</li>
                <li>{pwdR.upper ? "✅" : "❌"} Una mayúscula</li>
                <li>{pwdR.lower ? "✅" : "❌"} Una minúscula</li>
                <li>{pwdR.digit ? "✅" : "❌"} Un número</li>
              </ul>
            )}
          </label>

          <label className="space-y-1">
            <span className="text-sm">Confirmar contraseña</span>
            <input
              type={showPwd ? "text" : "password"}
              className="w-full px-3 py-2 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800"
              value={creds.confirm}
              onChange={(e)=>setCreds(c=>({...c, confirm: e.target.value}))}
              placeholder="••••••••"
            />
            {errors.confirm && <span className="text-xs text-red-500">{errors.confirm}</span>}
            {!errors.confirm && creds.confirm && !match && (
              <span className="text-xs text-red-500">No coincide con la contraseña.</span>
            )}
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!creds.sendVerification}
              onChange={(e)=>setCreds(c=>({...c, sendVerification: e.target.checked}))}
            />
            <span>Enviar correo de verificación</span>
          </label>
        </section>

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
<<<<<<< HEAD
            <button type="submit" className="px-4 py-2 rounded bg-black text-white dark:bg-white dark:text-black">
              {editing ? "Guardar cambios" : "Crear"}
=======
            {/* Enviar explícito usando handleSubmit directamente */}
            <button
              type="button"
              onClick={(e) => handleSubmit(e)}  // ← CAMBIO ÚNICO para asegurar el submit
              disabled={submitting}
              className={`px-4 py-2 rounded ${submitting ? "opacity-60 cursor-not-allowed" : "bg-black text-white dark:bg-white dark:text-black"}`}
            >
              {submitting ? (editing ? "Guardando..." : "Creando...") : (editing ? "Guardar cambios" : "Crear")}
>>>>>>> c92648ee3f5a66fdc180f956f99882d154e2c46c
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

<<<<<<< HEAD
function Field({ label, name, value, onChange, type = "text", className = "", error, placeholder }) {
=======
/** Field: acepta 'required' y 'inputRef' para foco controlado */
function Field({ label, name, value, onChange, type="text", className="", error, placeholder, required=false, inputRef }) {
>>>>>>> c92648ee3f5a66fdc180f956f99882d154e2c46c
  return (
    <label className={`space-y-1 ${className}`}>
      <span className="text-sm">{label}</span>
      <input
        ref={inputRef}
        name={name}
        type={type}
        className="w-full px-3 py-2 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800"
        value={value}
        placeholder={placeholder}
<<<<<<< HEAD
        onChange={(e) => onChange(name, e.target.value)}
=======
        onChange={(e)=>onChange(name, e.target.value)}
        required={required}
>>>>>>> c92648ee3f5a66fdc180f956f99882d154e2c46c
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
        name={name}
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
