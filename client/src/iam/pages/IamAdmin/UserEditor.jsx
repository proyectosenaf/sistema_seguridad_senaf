// client/src/iam/pages/IamAdmin/UserEditor.jsx
import React, { useEffect, useState } from "react";
import { iamApi } from "../../api/iamApi";

const ESTADOS_CIVILES = ["Soltero/a","Casado/a","Divorciado/a","Viudo/a","Unión libre"];

export default function UserEditor({ value, onClose, onSaved }) {
  const [roles, setRoles] = useState([]);

  const [form, setForm] = useState({
    // PERSONALES (sin id_persona en UI)
    nombreCompleto: value?.nombreCompleto || "",
    tipoDni: value?.tipoDni || "Identidad",
    dni: value?.dni || "",
    estadoCivil: value?.estadoCivil || "",
    fechaNacimiento: value?.fechaNacimiento ? String(value.fechaNacimiento).slice(0,10) : "",
    paisNacimiento: value?.paisNacimiento || "",
    ciudadNacimiento: value?.ciudadNacimiento || "",
    municipioNacimiento: value?.municipioNacimiento || "",
    correoPersona: value?.correoPersona || "",
    profesion: value?.profesion || "",
    lugarTrabajo: value?.lugarTrabajo || "",
    telefono: value?.telefono || "",
    domicilio: value?.domicilio || "",
    // IAM
    roles: Array.isArray(value?.roles) ? value.roles : [],
    active: value?.active !== false,
  });

  useEffect(() => {
    (async () => {
      try {
        const r = await iamApi.listRoles();
        const items = r?.items || r?.roles || [];
        const names = items.map(it => typeof it === "string" ? it : (it.name || it._id)).filter(Boolean);
        setRoles(names);
      } catch {
        setRoles(["admin","guardia","supervisor","ti","visitante"]);
      }
    })();
  }, []);

  function setField(name, value) {
    setForm(prev => ({ ...prev, [name]: value }));
  }

  async function save() {
    const payload = { ...form }; // id_persona lo maneja el backend
    if (value?._id) await iamApi.updateUser(value._id, payload);
    else await iamApi.createUser(payload);
    onSaved?.();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-neutral-900 w-[720px] max-w-[95vw] rounded-xl p-5 space-y-4 border border-neutral-200 dark:border-neutral-700">
        <div className="text-lg font-medium">{value?._id ? "Editar usuario" : "Nuevo usuario"}</div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Nombre completo" value={form.nombreCompleto} onChange={(v)=>setField("nombreCompleto", v)} />

          <div className="md:col-span-2">
            <div className="text-sm">Documento</div>
            <div className="flex gap-2 mt-1">
              <select
                className="px-3 py-2 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800"
                value={form.tipoDni}
                onChange={(e)=>setField("tipoDni", e.target.value)}
              >
                <option>Identidad</option>
                <option>Pasaporte</option>
              </select>
              <input
                className="flex-1 px-3 py-2 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800"
                value={form.dni}
                onChange={(e)=>setField("dni", e.target.value)}
              />
            </div>
          </div>

          <Select label="Estado civil" value={form.estadoCivil} onChange={(v)=>setField("estadoCivil", v)} options={ESTADOS_CIVILES} />
          <Field type="date" label="Fecha de nacimiento" value={form.fechaNacimiento} onChange={(v)=>setField("fechaNacimiento", v)} />

          <Field label="País nacimiento" value={form.paisNacimiento} onChange={(v)=>setField("paisNacimiento", v)} />
          <Field label="Ciudad nacimiento" value={form.ciudadNacimiento} onChange={(v)=>setField("ciudadNacimiento", v)} />
          <Field label="Municipio nacimiento" value={form.municipioNacimiento} onChange={(v)=>setField("municipioNacimiento", v)} />

          <Field label="Correo de la persona" value={form.correoPersona} onChange={(v)=>setField("correoPersona", v)} />
          <Field label="Profesión u oficio" value={form.profesion} onChange={(v)=>setField("profesion", v)} />
          <Field label="Dónde labora" value={form.lugarTrabajo} onChange={(v)=>setField("lugarTrabajo", v)} />
          <Field label="Teléfono" value={form.telefono} onChange={(v)=>setField("telefono", v)} />
          <Field className="md:col-span-2" label="Domicilio actual" value={form.domicilio} onChange={(v)=>setField("domicilio", v)} />

          {/* Roles */}
          <div className="md:col-span-2">
            <div className="text-sm mb-1">Roles</div>
            <div className="flex flex-wrap gap-2">
              {roles.map(r => {
                const on = form.roles?.includes(r);
                return (
                  <button
                    key={r}
                    type="button"
                    className={`text-sm px-2 py-1 rounded border border-neutral-300 dark:border-neutral-600 ${on ? "bg-black text-white dark:bg-white dark:text-black" : "bg-white dark:bg-neutral-800 text-black dark:text-white"}`}
                    onClick={() => {
                      const set = new Set(form.roles || []);
                      on ? set.delete(r) : set.add(r);
                      setField("roles", [...set]);
                    }}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active} onChange={e=>setField("active", e.target.checked)} />
            Activo
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <button className="px-3 py-2 rounded bg-gray-200 dark:bg-neutral-800" onClick={onClose}>Cancelar</button>
          <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={save}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type="text", className="" }) {
  return (
    <label className={`space-y-1 ${className}`}>
      <div className="text-sm">{label}</div>
      <input
        type={type}
        className="w-full px-3 py-2 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800"
        value={value}
        onChange={(e)=>onChange(e.target.value)}
      />
    </label>
  );
}

function Select({ label, value, onChange, options=[] }) {
  return (
    <label className="space-y-1">
      <div className="text-sm">{label}</div>
      <select
        className="w-full px-3 py-2 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800"
        value={value}
        onChange={(e)=>onChange(e.target.value)}
      >
        <option value="">Seleccionar</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
