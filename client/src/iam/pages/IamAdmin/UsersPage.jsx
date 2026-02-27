// client/src/iam/pages/IamAdmin/UsersPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { iamApi } from "../../api/iamApi.js";
import { Edit3, Trash2 } from "lucide-react";

// mismo flag que en iamApi.js, pero del lado del cliente
const DISABLE_AUTH = import.meta.env.VITE_DISABLE_AUTH === "1";

/* ===================== Helpers básicos ===================== */

function getPath(obj, path) {
  return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function getVal(obj, paths, fallback = "") {
  for (const p of paths) {
    const v = p.includes(".") ? getPath(obj, p) : obj?.[p];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return fallback;
}
function toDateInputSafe(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/** Parse "YYYY-MM-DD" a Date (sin problema de zona horaria) */
function parseDateYMD(value) {
  if (!value || typeof value !== "string") return null;
  const parts = value.split("-");
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map((n) => parseInt(n, 10));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** Formatea Date -> "YYYY-MM-DD" */
function formatDateYMD(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Normaliza el objeto de backend a las claves del form */
function mapUserToFormSafe(api = {}, { estadosCiviles = [] } = {}) {
  const nombreFromParts =
    [getVal(api, ["persona.nombres"], ""), getVal(api, ["persona.apellidos"], "")]
      .join(" ")
      .trim() || undefined;

  const fechaRaw = getVal(api, [
    "fechaNacimiento",
    "fecha_nacimiento",
    "birthDate",
    "persona.fechaNacimiento",
    "persona.fecha_nacimiento",
    "persona.fnac",
    "datosNacimiento.fecha",
    "nacimiento.fecha",
  ]);

  let roles = getVal(api, ["roles", "persona.roles"], []);
  if (typeof roles === "string") roles = [roles];
  if (Array.isArray(roles)) {
    roles = roles
      .map((r) =>
        typeof r === "string" ? r : r?.code || r?.name || r?.nombre || r?.key || ""
      )
      .filter(Boolean);
  } else {
    roles = [];
  }

  const active =
    getVal(api, ["active", "persona.active"], undefined) ??
    (getVal(api, ["estado"], "") === "activo"
      ? true
      : getVal(api, ["estado"], "") === "inactivo"
      ? false
      : true);

  const civil = getVal(
    api,
    ["estadoCivil", "estado_civil", "civilStatus", "persona.estadoCivil"],
    ""
  );
  const civilOk = Array.isArray(estadosCiviles) && estadosCiviles.includes(civil) ? civil : "";

  return {
    // PERSONALES
    nombreCompleto: getVal(
      api,
      ["nombreCompleto", "fullName", "name", "persona.nombreCompleto"],
      nombreFromParts || ""
    ),
    tipoDni: getVal(api, ["tipoDni", "persona.tipoDni"], "Identidad"),
    dni: getVal(
      api,
      ["dni", "documento", "num_documento", "numeroDocumento", "persona.dni", "persona.numeroDocumento"],
      ""
    ),
    estadoCivil: civilOk,
    fechaNacimiento: toDateInputSafe(fechaRaw),
    paisNacimiento: getVal(
      api,
      ["paisNacimiento", "pais_nacimiento", "countryOfBirth", "persona.pais", "datosNacimiento.pais", "nacimiento.pais"],
      ""
    ),
    ciudadNacimiento: getVal(
      api,
      ["ciudadNacimiento", "ciudad_nacimiento", "cityOfBirth", "persona.ciudad", "datosNacimiento.ciudad", "nacimiento.ciudad"],
      ""
    ),
    municipioNacimiento: getVal(
      api,
      ["municipioNacimiento", "municipio", "persona.municipio", "datosNacimiento.municipio", "nacimiento.municipio", "ubicacion.municipio"],
      ""
    ),
    correoPersona: getVal(
      api,
      ["correoPersona", "email", "correo", "mail", "persona.correo", "persona.email"],
      ""
    ),
    profesion: getVal(api, ["profesion", "ocupacion", "persona.ocupacion"], ""),
    lugarTrabajo: getVal(
      api,
      ["lugarTrabajo", "dondeLabora", "empresa", "persona.lugar_trabajo", "persona.dondeLabora"],
      ""
    ),
    telefono: getVal(
      api,
      ["telefono", "phone", "celular", "tel", "telefono1", "telefono2", "persona.telefono", "persona.celular", "contacto.telefono"],
      ""
    ),
    domicilio: getVal(
      api,
      ["domicilio", "direccion", "address", "direccionResidencia", "persona.direccion", "persona.domicilio", "ubicacion.direccion"],
      ""
    ),
    // IAM
    roles,
    active,
    id_persona: getVal(api, ["id_persona", "persona.id_persona"], null),
    _id: getVal(api, ["_id", "id", "persona._id"], undefined),
  };
}

/* ===================== UI helpers ===================== */

function RoleBadges({ roles = [], roleLabelMap = {} }) {
  const labels = Array.isArray(roles) ? roles.map((code) => roleLabelMap[code] || code) : [];
  return (
    <div className="flex flex-wrap gap-1">
      {labels.length === 0 ? (
        <span className="text-neutral-500">—</span>
      ) : (
        labels.map((r, i) => (
          <span
            key={`${r}-${i}`}
            className="text-xs px-2 py-1 rounded-full border border-cyan-400/40 bg-cyan-500/5 text-cyan-100"
          >
            {r}
          </span>
        ))
      )}
    </div>
  );
}

function RoleSelect({ value = [], onChange, availableRoles = [] }) {
  const [open, setOpen] = useState(false);

  const selected = new Set(Array.isArray(value) ? value : []);
  const normalizedRoles = useMemo(
    () =>
      (availableRoles || [])
        .map((r) => ({
          code: r.code || r.key || r.name || r._id,
          label: r.name || r.label || r.code || r.key || r._id,
        }))
        .filter((r) => !!r.code),
    [availableRoles]
  );

  const toggle = (code) => {
    const copy = new Set(selected);
    if (copy.has(code)) copy.delete(code);
    else copy.add(code);
    onChange(Array.from(copy));
  };

  const labelSelected =
    normalizedRoles
      .filter((r) => selected.has(r.code))
      .map((r) => r.label)
      .join(", ") || "Seleccionar rol(es)";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-3 py-2 rounded-lg border border-cyan-500/40 bg-slate-950/60 text-left text-sm shadow-inner flex items-center gap-2"
      >
        <span>{labelSelected}</span>
        <span className="ml-auto text-xs opacity-70">▾</span>
      </button>
      {open && (
        <div className="absolute z-10 mt-1 w-full max-h-60 overflow-auto rounded-xl border border-cyan-500/40 bg-slate-950/95 shadow-[0_0_25px_rgba(34,211,238,0.35)]">
          {normalizedRoles.length === 0 && (
            <div className="px-3 py-2 text-sm text-neutral-500">No hay roles configurados.</div>
          )}
          {normalizedRoles.map((r) => (
            <label
              key={r.code}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-cyan-500/10 cursor-pointer"
            >
              <input
                type="checkbox"
                className="scale-110 accent-cyan-500"
                checked={selected.has(r.code)}
                onChange={() => toggle(r.code)}
              />
              <span>{r.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/** Selector de país (catálogo viene del backend) */
function CountrySelect({ label, name, value, onChange, items = [] }) {
  const [open, setOpen] = useState(false);
  const selected = value || "";
  const listRef = useRef(null);

  const handleSelect = (val) => {
    onChange(name, val);
    setOpen(false);
  };

  const scrollList = (direction) => {
    if (!listRef.current) return;
    const delta = direction === "up" ? -120 : 120;
    listRef.current.scrollBy({ top: delta, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <label className="space-y-1 block">
        <span className="text-sm text-neutral-200">{label}</span>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full px-3 py-2 rounded-lg border border-cyan-500/40 bg-slate-950/50 text-sm flex items-center gap-2 shadow-inner"
        >
          <span className={selected ? "text-neutral-100" : "text-neutral-400"}>
            {selected || "Seleccionar país"}
          </span>
          <span className="ml-auto text-xs opacity-70">▾</span>
        </button>
      </label>

      {open && (
        <div className="absolute z-40 mt-1 w-full rounded-xl border border-cyan-500/50 bg-slate-950/70 backdrop-blur-sm shadow-[0_0_25px_rgba(34,211,238,0.45)] flex">
          <div ref={listRef} className="flex-1 max-h-56 overflow-y-auto">
            {(items || []).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => handleSelect(c)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-cyan-500/15 ${
                  selected === c ? "bg-cyan-500/20 text-cyan-100" : "text-neutral-100"
                }`}
              >
                {c}
              </button>
            ))}
            {(items || []).length === 0 && (
              <div className="px-3 py-2 text-sm text-neutral-500">Catálogo no disponible.</div>
            )}
          </div>

          <div className="flex flex-col border-l border-cyan-500/40">
            <button
              type="button"
              onClick={() => scrollList("up")}
              className="flex-1 px-2 py-2 text-xs text-neutral-100 hover:bg-cyan-500/20"
              title="Subir"
            >
              ▲
            </button>
            <button
              type="button"
              onClick={() => scrollList("down")}
              className="flex-1 px-2 py-2 text-xs text-neutral-100 hover:bg-cyan-500/20 border-t border-cyan-500/40"
              title="Bajar"
            >
              ▼
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Selector de profesión (catálogo viene del backend) */
function ProfessionSelect({ value, onChange, items = [] }) {
  const [open, setOpen] = useState(false);
  const selected = value || "";
  const listRef = useRef(null);

  const handleSelect = (val) => {
    onChange(val);
    setTimeout(() => setOpen(false), 0);
  };

  const scrollList = (direction) => {
    if (!listRef.current) return;
    const delta = direction === "up" ? -120 : 120;
    listRef.current.scrollBy({ top: delta, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-3 py-2 rounded-lg border border-cyan-500/40 bg-slate-950/60 text-sm flex items-center gap-2 shadow-inner"
      >
        <span className={selected ? "text-neutral-100" : "text-neutral-400"}>
          {selected || "Seleccionar profesión u oficio"}
        </span>
        <span className="ml-auto text-xs opacity-70">▾</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-cyan-500/50 bg-slate-950/95 shadow-[0_0_25px_rgba(34,211,238,0.45)] flex">
          <div ref={listRef} className="flex-1 max-h-56 overflow-y-auto">
            {(items || []).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handleSelect(p)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-cyan-500/15 ${
                  selected === p ? "bg-cyan-500/20 text-cyan-100" : "text-neutral-100"
                }`}
              >
                {p}
              </button>
            ))}
            {(items || []).length === 0 && (
              <div className="px-3 py-2 text-sm text-neutral-500">Catálogo no disponible.</div>
            )}
          </div>

          <div className="flex flex-col border-l border-cyan-500/40">
            <button
              type="button"
              onClick={() => scrollList("up")}
              className="flex-1 px-2 py-2 text-xs text-neutral-100 hover:bg-cyan-500/20"
              title="Subir"
            >
              ▲
            </button>
            <button
              type="button"
              onClick={() => scrollList("down")}
              className="flex-1 px-2 py-2 text-xs text-neutral-100 hover:bg-cyan-500/20 border-t border-cyan-500/40"
              title="Bajar"
            >
              ▼
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Calendario para fecha de nacimiento */
function BirthDatePicker({ label, name, value, onChange }) {
  const [open, setOpen] = useState(false);

  const selectedDate = value ? parseDateYMD(value) : null;

  // Inicializa y se mantiene, pero se sincroniza cuando cambie value
  const initialView = selectedDate || new Date();
  const [viewDate, setViewDate] = useState(initialView);

  // Si el usuario abre el picker o cambia el value desde afuera, sincroniza
  useEffect(() => {
    if (!open) return;
    setViewDate(selectedDate || new Date());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value]);

  const months = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];

  // ✅ FIX: keys únicas (hay dos "M")
  const daysShort = ["D", "L", "M", "M", "J", "V", "S"];

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const startWeekday = firstDayOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const handleSelectDay = (day) => {
    if (!day) return;
    const d = new Date(year, month, day);
    const ymd = formatDateYMD(d);
    onChange(name, ymd);
    setOpen(false);
  };

  const goMonth = (delta) => {
    setViewDate((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + delta);
      return d;
    });
  };

  return (
    <div className="relative">
      <label className="space-y-1 block">
        <span className="text-sm text-neutral-200">{label}</span>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full px-3 py-2 rounded-lg border border-cyan-500/40 bg-slate-950/70 text-sm flex items-center gap-2 shadow-inner"
        >
          <span className={value ? "text-neutral-100" : "text-neutral-400"}>
            {value || "Seleccionar fecha"}
          </span>
          <span className="ml-auto text-xs opacity-70">📅</span>
        </button>
      </label>

      {open && (
        <div className="absolute z-40 mt-1 w-72 rounded-xl border border-cyan-500/60 bg-slate-950/95 backdrop-blur-sm shadow-[0_0_25px_rgba(34,211,238,0.55)] p-3">
          <div className="flex items-center justify-between mb-2 text-sm text-neutral-100">
            <button
              type="button"
              onClick={() => goMonth(-1)}
              className="px-2 py-1 rounded-md border border-cyan-500/40 hover:bg-cyan-500/15 text-xs"
            >
              ◀
            </button>
            <div className="font-medium">
              {months[month]} {year}
            </div>
            <button
              type="button"
              onClick={() => goMonth(1)}
              className="px-2 py-1 rounded-md border border-cyan-500/40 hover:bg-cyan-500/15 text-xs"
            >
              ▶
            </button>
          </div>

          <div className="grid grid-cols-7 text-[11px] text-center text-neutral-300 mb-1">
            {daysShort.map((d, i) => (
              <div key={`${d}-${i}`} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 text-sm">
            {cells.map((day, idx) => {
              if (!day) return <div key={`e-${idx}`} className="h-8" />;
              const isSelected =
                selectedDate &&
                selectedDate.getFullYear() === year &&
                selectedDate.getMonth() === month &&
                selectedDate.getDate() === day;

              return (
                <button
                  key={`d-${year}-${month}-${day}`}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-xs ${
                    isSelected
                      ? "bg-cyan-500 text-slate-950 font-semibold"
                      : "text-neutral-100 hover:bg-cyan-500/20"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* Reglas para validar password */
function passwordRules(p = "") {
  return {
    length: p.length >= 8,
    upper: /[A-Z]/.test(p),
    lower: /[a-z]/.test(p),
    digit: /\d/.test(p),
  };
}

/* ===================== Página principal ===================== */

export default function UsersPage() {
  // ✅ Sin Auth0: token solo desde login local (localStorage)
  const getToken = async () => {
    if (DISABLE_AUTH) return null;
    const localToken = localStorage.getItem("token");
    return localToken || null;
  };

  const [items, setItems] = useState([]);
  const [roleCatalog, setRoleCatalog] = useState([]);
  const [catalogs, setCatalogs] = useState({
    estadosCiviles: [],
    countries: [],
    profesiones: [],
  });

  const [q, setQ] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [errors, setErrors] = useState({});

  const STEP = 10;
  const [visibleCount, setVisibleCount] = useState(STEP);

  const empty = {
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
    roles: [],
    active: true,
  };
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);

  const [creds, setCreds] = useState({
    password: "",
    confirm: "",
    sendVerification: false,
  });
  const [showPwd, setShowPwd] = useState(false);

  const pwdR = passwordRules(creds.password);
  const match = creds.password && creds.confirm && creds.password === creds.confirm;
  const showPwdRules = creds.password && creds.password.length > 0;

  const firstFieldRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);

  const roleLabelMap = useMemo(
    () =>
      Object.fromEntries(
        (roleCatalog || []).map((r) => [
          r.code || r.key || r.name || r._id,
          r.name || r.label || r.code || r.key || "(sin nombre)",
        ])
      ),
    [roleCatalog]
  );

  async function load() {
    try {
      setLoading(true);
      setErr("");

      const token = await getToken();

      if (!DISABLE_AUTH && !token) {
        setErr("No se pudo obtener token de sesión. Inicia sesión de nuevo para gestionar usuarios.");
        setItems([]);
        setRoleCatalog([]);
        return;
      }

      // ✅ catálogos vienen del backend (si implementaste endpoints)
      const catPromise =
        typeof iamApi.getCatalogs === "function"
          ? iamApi.getCatalogs(token)
          : Promise.resolve({});

      const [resUsers, resRoles, resCats] = await Promise.all([
        iamApi.listUsers("", token),
        iamApi.listRoles ? iamApi.listRoles(token) : Promise.resolve({}),
        catPromise,
      ]);

      setItems(resUsers.items || []);

      const rolesRaw = resRoles?.items || resRoles?.roles || [];
      setRoleCatalog(Array.isArray(rolesRaw) ? rolesRaw : []);

      const estadosCiviles = resCats?.estadosCiviles || resCats?.civilStatus || [];
      const countries = resCats?.countries || resCats?.paises || [];
      const profesiones = resCats?.profesiones || resCats?.professions || resCats?.oficios || [];

      setCatalogs({
        estadosCiviles: Array.isArray(estadosCiviles) ? estadosCiviles : [],
        countries: Array.isArray(countries) ? countries : [],
        profesiones: Array.isArray(profesiones) ? profesiones : [],
      });
    } catch (e) {
      setErr(e?.message || "Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredAll = useMemo(() => {
    const t = q.trim().toLowerCase();
    let res = items;
    if (t) {
      res = res.filter((u) =>
        (u.nombreCompleto || u.name || "").toLowerCase().includes(t) ||
        (u.correoPersona || u.email || "").toLowerCase().includes(t) ||
        (u.dni || "").toLowerCase().includes(t) ||
        String(u.id_persona || "").toLowerCase().includes(t)
      );
    }
    if (onlyActive) res = res.filter((u) => u.active !== false);
    return res;
  }, [items, q, onlyActive]);

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function validate() {
    const v = {};
    if (!form.nombreCompleto.trim()) v.nombreCompleto = "Requerido";
    if (!form.dni.trim()) v.dni = "Requerido";
    if (!form.correoPersona.trim()) v.correoPersona = "Requerido";
    else if (!/^\S+@\S+\.\S+$/.test(form.correoPersona)) v.correoPersona = "Correo inválido";

    if (!Array.isArray(form.roles) || form.roles.length === 0) {
      v.roles = "Seleccione al menos un rol";
    }

    if (creds.password || creds.confirm) {
      if (!creds.password) v.password = "Debe ingresar contraseña";
      if (!creds.confirm) v.confirm = "Debe confirmar la contraseña";
      if (creds.password !== creds.confirm) v.confirm = "Las contraseñas no coinciden";
      if (!pwdR.length || !pwdR.upper || !pwdR.lower || !pwdR.digit) {
        v.password = "La contraseña no cumple los requisitos mínimos";
      }
    }

    return v;
  }

  async function triggerVerification(userId, email) {
    if (!/^\S+@\S+\.\S+$/.test(email || "")) throw new Error("Correo inválido para verificación");

    const token = await getToken();
    if (!DISABLE_AUTH && !token) throw new Error("No hay token para enviar verificación");

    if (typeof iamApi.sendVerificationEmail === "function") {
      return await iamApi.sendVerificationEmail(userId, email, token);
    } else if (typeof iamApi.sendVerification === "function") {
      return await iamApi.sendVerification({ userId, email, token });
    } else {
      throw new Error("La API de verificación no está implementada en iamApi");
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const v = validate();
    setErrors(v);
    const keys = Object.keys(v);
    if (keys.length) {
      const firstKey = keys[0];
      const el = document.querySelector(`[name="${firstKey}"]`);
      if (el?.focus) el.focus();
      alert("Corrija los errores del formulario antes de guardar.");
      return;
    }

    try {
      setSubmitting(true);

      const token = await getToken();
      if (!DISABLE_AUTH && !token) {
        alert("No se pudo obtener token de sesión. Inicia sesión nuevamente para guardar.");
        return;
      }

      const payload = { ...form };
      if (creds.password) payload.password = creds.password;
      payload.sendVerification = !!creds.sendVerification;

      let res;
      let savedId = editing;

      if (editing) {
        res = await iamApi.updateUser(editing, payload, token);
        savedId =
          res?._id || res?.id || res?.userId || res?.data?._id || res?.data?.item?._id || savedId;
        alert("Usuario actualizado correctamente");
      } else {
        res = await iamApi.createUser(payload, token);
        savedId = res?._id || res?.id || res?.userId || res?.data?._id || res?.data?.item?._id;
        alert("Usuario creado correctamente ✅");
      }

      if (creds.sendVerification && savedId && form.correoPersona) {
        try {
          await triggerVerification(savedId, form.correoPersona);
          alert("Se envió el correo de verificación a " + form.correoPersona);
        } catch (ev) {
          console.warn("[UsersPage] verificación no enviada:", ev);
          alert("⚠️ No se pudo enviar la verificación: " + (ev?.message || "revisa el backend"));
        }
      }

      setForm(empty);
      setEditing(null);
      setCreds({ password: "", confirm: "", sendVerification: false });
      setErrors({});
      await load();
    } catch (e2) {
      alert("⚠️ Error al guardar: " + (e2?.message || "Revisa la consola"));
      console.error("[UsersPage] submit error:", e2);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(u) {
    try {
      const token = await getToken();
      if (!DISABLE_AUTH && !token) {
        alert("No se pudo obtener token de sesión. Inicia sesión nuevamente para cambiar estado.");
        return;
      }

      if (u.active === false) await iamApi.enableUser(u._id, token);
      else await iamApi.disableUser(u._id, token);

      await load();
    } catch (e) {
      alert(e?.message || "No se pudo cambiar el estado");
    }
  }

  async function startEdit(u) {
    setEditing(u._id);
    setCreds({ password: "", confirm: "", sendVerification: false });

    window.scrollTo({ top: 0, behavior: "smooth" });

    setLoading(true);
    let full = u;

    try {
      if (typeof iamApi.getUser === "function") {
        const token = await getToken();
        const r = await iamApi.getUser(u._id, token);
        full = r?.item || r?.user || r || u;
      } else if (typeof iamApi.getUserById === "function") {
        const token = await getToken();
        const res = await iamApi.getUserById(u._id, token);
        full =
          res?.data?.item?.usuario ??
          res?.data?.item?.user ??
          res?.data?.item ??
          res?.data?.usuario ??
          res?.data?.user ??
          res?.data ??
          res?.usuario ??
          res?.user ??
          res ??
          u;
      }
    } catch (e) {
      console.warn("[UsersPage] no se pudo obtener detalle; usando item de lista:", e);
    } finally {
      setLoading(false);
    }

    try {
      setForm((prev) => ({
        ...prev,
        ...mapUserToFormSafe(full, { estadosCiviles: catalogs.estadosCiviles }),
      }));
    } catch {
      setForm((prev) => ({
        ...prev,
        ...mapUserToFormSafe(u, { estadosCiviles: catalogs.estadosCiviles }),
      }));
    }

    setTimeout(() => firstFieldRef.current?.focus?.(), 120);
  }

  function cancelEdit() {
    setEditing(null);
    setForm(empty);
    setCreds({ password: "", confirm: "", sendVerification: false });
    setErrors({});
    setTimeout(() => firstFieldRef.current?.focus?.(), 300);
  }

  async function handleDelete(u) {
    const ok = window.confirm(
      `¿Seguro que deseas eliminar al usuario "${u.nombreCompleto || u.name || ""}"?`
    );
    if (!ok) return;

    try {
      const token = await getToken();
      if (!DISABLE_AUTH && !token) {
        alert("No se pudo obtener token de sesión. Inicia sesión nuevamente para eliminar.");
        return;
      }

      if (typeof iamApi.deleteUser === "function") {
        await iamApi.deleteUser(u._id, token);
      } else {
        throw new Error("La API no soporta eliminar usuarios aún");
      }

      if (editing === u._id) cancelEdit();
      await load();
      alert("Usuario eliminado correctamente.");
    } catch (e) {
      alert(e?.message || "No se pudo eliminar el usuario");
    }
  }

  const visibleList = filteredAll.slice(0, visibleCount);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#020617] via-[#020617] to-black text-white p-6 md:p-8 space-y-8">
      <header className="max-w-5xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-semibold mb-2">
          Administración de Usuarios (IAM)
        </h1>
        <p className="text-sm text-neutral-400 max-w-2xl">
          Crea, edita y administra los usuarios del sistema SENAF, incluyendo sus datos personales y
          roles de acceso.
        </p>
      </header>

      {/* Formulario principal */}
      <section className="max-w-5xl mx-auto bg-slate-900/60 border border-cyan-500/30 rounded-2xl shadow-[0_0_30px_rgba(34,211,238,0.25)] p-5 md:p-7 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-lg md:text-xl font-semibold">
            {editing ? "Editar usuario" : "Registrar nuevo usuario"}
          </h2>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setForm(empty);
              setCreds({ password: "", confirm: "", sendVerification: false });
              setErrors({});
            }}
            className="text-xs md:text-sm px-3 py-1.5 rounded-lg border border-cyan-500/60 hover:bg-cyan-500/10 transition-colors"
          >
            Limpiar formulario
          </button>
        </div>

        {err && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
            {err}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Datos personales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm text-neutral-200">Nombre completo</label>
              <input
                ref={firstFieldRef}
                name="nombreCompleto"
                value={form.nombreCompleto}
                onChange={(e) => setField("nombreCompleto", e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-cyan-500/30 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
                placeholder="Ej. Juan Pérez"
              />
              {errors.nombreCompleto && (
                <p className="text-xs text-red-400">{errors.nombreCompleto}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm text-neutral-200">Tipo de documento</label>
              <select
                name="tipoDni"
                value={form.tipoDni}
                onChange={(e) => setField("tipoDni", e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-cyan-500/30 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
              >
                <option>Identidad</option>
                <option>Pasaporte</option>
                <option>RTN</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm text-neutral-200">Número</label>
              <input
                name="dni"
                value={form.dni}
                onChange={(e) => setField("dni", e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-cyan-500/30 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
                placeholder="0000-0000-00000"
              />
              {errors.dni && <p className="text-xs text-red-400">{errors.dni}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-sm text-neutral-200">Estado civil</label>
              <select
                name="estadoCivil"
                value={form.estadoCivil}
                onChange={(e) => setField("estadoCivil", e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-cyan-500/30 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
              >
                <option value="">Seleccione…</option>
                {(catalogs.estadosCiviles || []).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Fecha / país / ciudad / municipio */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <BirthDatePicker
              label="Fecha de nacimiento"
              name="fechaNacimiento"
              value={form.fechaNacimiento}
              onChange={setField}
            />
            <CountrySelect
              label="País de nacimiento"
              name="paisNacimiento"
              value={form.paisNacimiento}
              onChange={setField}
              items={catalogs.countries}
            />
            <div className="space-y-1">
              <label className="text-sm text-neutral-200">Ciudad de nacimiento</label>
              <input
                name="ciudadNacimiento"
                value={form.ciudadNacimiento}
                onChange={(e) => setField("ciudadNacimiento", e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-cyan-500/30 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-neutral-200">Municipio de nacimiento</label>
              <input
                name="municipioNacimiento"
                value={form.municipioNacimiento}
                onChange={(e) => setField("municipioNacimiento", e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-cyan-500/30 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
              />
            </div>
          </div>

          {/* Contacto y trabajo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm text-neutral-200">Correo electrónico</label>
              <input
                name="correoPersona"
                type="email"
                value={form.correoPersona}
                onChange={(e) => setField("correoPersona", e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-cyan-500/30 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
                placeholder="usuario@dominio.com"
              />
              {errors.correoPersona && (
                <p className="text-xs text-red-400">{errors.correoPersona}</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm text-neutral-200">Teléfono / Celular</label>
              <input
                name="telefono"
                value={form.telefono}
                onChange={(e) => setField("telefono", e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-cyan-500/30 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
                placeholder="+504 9999-9999"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-neutral-200">Lugar de trabajo</label>
              <input
                name="lugarTrabajo"
                value={form.lugarTrabajo}
                onChange={(e) => setField("lugarTrabajo", e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-cyan-500/30 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-neutral-200">Profesión / oficio</label>
              <ProfessionSelect
                value={form.profesion}
                onChange={(val) => setField("profesion", val)}
                items={catalogs.profesiones}
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-sm text-neutral-200">Domicilio / Dirección</label>
              <input
                name="domicilio"
                value={form.domicilio}
                onChange={(e) => setField("domicilio", e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-cyan-500/30 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
                placeholder="Barrio, colonia, referencia…"
              />
            </div>
          </div>

          {/* Roles + estado + password */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm text-neutral-200">Roles en el sistema</label>
              <RoleSelect
                value={form.roles}
                onChange={(val) => setField("roles", val)}
                availableRoles={roleCatalog}
              />
              {errors.roles && <p className="text-xs text-red-400">{errors.roles}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-sm text-neutral-200">Estado</label>
              <select
                name="active"
                value={form.active ? "1" : "0"}
                onChange={(e) => setField("active", e.target.value === "1")}
                className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-cyan-500/30 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
              >
                <option value="1">Activo</option>
                <option value="0">Inactivo</option>
              </select>
            </div>
          </div>

          {/* Contraseña y verificación */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            <div className="space-y-1">
              <label className="text-sm text-neutral-200">
                Contraseña
                {!editing && (
                  <span className="text-xs text-cyan-300 ml-2">(solo al crear o cambiar)</span>
                )}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type={showPwd ? "text" : "password"}
                  value={creds.password}
                  onChange={(e) => setCreds((prev) => ({ ...prev, password: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-cyan-500/30 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  className="px-2 py-1 text-xs rounded-md border border-cyan-500/40 hover:bg-cyan-500/10"
                >
                  {showPwd ? "Ocultar" : "Ver"}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-400">{errors.password}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-sm text-neutral-200">Confirmar contraseña</label>
              <input
                type={showPwd ? "text" : "password"}
                className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-cyan-500/30 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
                value={creds.confirm}
                onChange={(e) => setCreds((prev) => ({ ...prev, confirm: e.target.value }))}
                placeholder="••••••••"
              />
              {errors.confirm && <span className="text-xs text-red-500">{errors.confirm}</span>}
              {!errors.confirm && creds.confirm && !match && (
                <span className="text-xs text-red-500">No coincide con la contraseña.</span>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm text-neutral-200">Verificación</label>
              <label className="flex items-center gap-2 text-xs text-neutral-300">
                <input
                  type="checkbox"
                  checked={creds.sendVerification}
                  onChange={async (e) => {
                    const checked = e.target.checked;
                    setCreds((prev) => ({ ...prev, sendVerification: checked }));

                    if (checked && editing && /^\S+@\S+\.\S+$/.test(form.correoPersona || "")) {
                      try {
                        setSubmitting(true);
                        await triggerVerification(editing, form.correoPersona);
                        alert("Se envió el correo de verificación a " + form.correoPersona);
                      } catch (ev) {
                        console.warn("[UsersPage] verificación inmediata falló:", ev);
                        alert(
                          "⚠️ No se pudo enviar verificación ahora: " +
                            (ev?.message || "se intentará al guardar, si está habilitado")
                        );
                      } finally {
                        setSubmitting(false);
                      }
                    }
                  }}
                />
                Enviar correo de verificación al guardar
              </label>
            </div>
          </div>

          {showPwdRules && (
            <div className="text-xs text-neutral-300 bg-slate-900/70 border border-cyan-500/30 rounded-lg px-3 py-2 space-y-1">
              <div className="font-semibold text-cyan-300 mb-1">Requisitos de contraseña:</div>
              <div>
                <span className={pwdR.length ? "text-green-400" : "text-red-400"}>
                  • Al menos 8 caracteres
                </span>
              </div>
              <div>
                <span className={pwdR.upper ? "text-green-400" : "text-red-400"}>
                  • Una letra mayúscula
                </span>
              </div>
              <div>
                <span className={pwdR.lower ? "text-green-400" : "text-red-400"}>
                  • Una letra minúscula
                </span>
              </div>
              <div>
                <span className={pwdR.digit ? "text-green-400" : "text-red-400"}>
                  • Un número
                </span>
              </div>
              <div>
                <span className={match ? "text-green-400" : "text-red-400"}>
                  • Coincidencia entre contraseña y confirmación
                </span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={cancelEdit}
              className="px-4 py-2 text-sm rounded-lg border border-neutral-500/50 text-neutral-200 hover:bg-neutral-700/40"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold shadow-[0_0_20px_rgba(34,211,238,0.6)] disabled:opacity-60"
            >
              {submitting ? "Guardando..." : editing ? "Guardar cambios" : "Crear usuario"}
            </button>
          </div>
        </form>
      </section>

      {/* Tabla de usuarios */}
      <section className="max-w-6xl mx-auto space-y-4">
        <div className="flex flex-col md:flex-row gap-3 justify-between items-start">
          <div>
            <h2 className="text-lg font-semibold mb-1">Usuarios registrados</h2>
            <p className="text-xs text-neutral-400">{filteredAll.length} usuario(s) encontrados</p>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre, correo o documento..."
              className="px-3 py-1.5 rounded-lg bg-slate-900/70 border border-cyan-500/30 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
            />
            <label className="flex items-center gap-2 text-xs text-neutral-300">
              <input
                type="checkbox"
                checked={onlyActive}
                onChange={(e) => setOnlyActive(e.target.checked)}
              />
              Mostrar solo activos
            </label>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-cyan-500/20 bg-slate-950/70 shadow-[0_0_25px_rgba(34,211,238,0.25)]">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-900/80 text-xs uppercase text-neutral-400 border-b border-cyan-500/20">
              <tr>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left">Documento</th>
                <th className="px-4 py-3 text-left">Correo</th>
                <th className="px-4 py-3 text-left">Roles</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-neutral-400">
                    Cargando usuarios…
                  </td>
                </tr>
              ) : visibleList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-neutral-400">
                    No hay usuarios que coincidan con el filtro.
                  </td>
                </tr>
              ) : (
                visibleList.map((u) => (
                  <tr key={u._id} className="border-b border-slate-800/70 hover:bg-slate-900/70">
                    <td className="px-4 py-3">
                      <div className="font-medium text-neutral-100">
                        {u.nombreCompleto || u.name || "(Sin nombre)"}
                      </div>
                      <div className="text-[11px] text-neutral-400">ID persona: {u.id_persona || "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-neutral-200">
                      <div className="text-xs">
                        {u.tipoDni || "Documento"}: <span className="font-mono">{u.dni || "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-neutral-200">{u.correoPersona || u.email || "—"}</td>
                    <td className="px-4 py-3">
                      <RoleBadges roles={u.roles} roleLabelMap={roleLabelMap} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold ${
                          u.active !== false
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-400/50"
                            : "bg-red-500/15 text-red-300 border border-red-400/50"
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full mr-1 bg-current" />
                        {u.active !== false ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => toggleActive(u)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-md border ${
                          u.active !== false
                            ? "border-yellow-400/60 text-yellow-200 hover:bg-yellow-400/15"
                            : "border-emerald-400/60 text-emerald-200 hover:bg-emerald-400/15"
                        }`}
                      >
                        {u.active !== false ? "Desactivar" : "Activar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(u)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-md border border-cyan-400/70 text-cyan-200 hover:bg-cyan-400/15"
                      >
                        <Edit3 className="w-3 h-3" />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(u)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-md border border-rose-500/70 text-rose-200 hover:bg-rose-500/15"
                      >
                        <Trash2 className="w-3 h-3" />
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {visibleCount < filteredAll.length && (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={() => setVisibleCount((v) => v + STEP)}
              className="px-4 py-2 text-sm rounded-lg border border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/10"
            >
              Ver más usuarios
            </button>
          </div>
        )}
      </section>
    </div>
  );
}