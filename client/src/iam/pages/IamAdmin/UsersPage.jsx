// client/src/iam/pages/IamAdmin/UsersPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { iamApi } from "../../api/iamApi.js";
import { Edit3, Trash2 } from "lucide-react";

const DISPLAY_ROLES = [
  "Administrador",
  "Supervisor",
  "Guardia",
  "Administrador IT",
  "Visita Externa",
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

const ESTADOS_CIVILES = ["Soltero/a", "Casado/a", "Divorciado/a", "Viudo/a", "Unión libre"];

/* 🌎 Lista de países (en español) */
const COUNTRIES = [
  "Afganistán",
  "Albania",
  "Alemania",
  "Andorra",
  "Angola",
  "Antigua y Barbuda",
  "Arabia Saudita",
  "Argelia",
  "Argentina",
  "Armenia",
  "Australia",
  "Austria",
  "Azerbaiyán",
  "Bahamas",
  "Bangladés",
  "Barbados",
  "Baréin",
  "Bélgica",
  "Belice",
  "Benín",
  "Bielorrusia",
  "Birmania (Myanmar)",
  "Bolivia",
  "Bosnia y Herzegovina",
  "Botsuana",
  "Brasil",
  "Brunéi",
  "Bulgaria",
  "Burkina Faso",
  "Burundi",
  "Bután",
  "Cabo Verde",
  "Camboya",
  "Camerún",
  "Canadá",
  "Catar",
  "Chad",
  "Chile",
  "China",
  "Chipre",
  "Colombia",
  "Comoras",
  "Corea del Norte",
  "Corea del Sur",
  "Costa de Marfil",
  "Costa Rica",
  "Croacia",
  "Cuba",
  "Dinamarca",
  "Dominica",
  "Ecuador",
  "Egipto",
  "El Salvador",
  "Emiratos Árabes Unidos",
  "Eritrea",
  "Eslovaquia",
  "Eslovenia",
  "España",
  "Estados Unidos",
  "Estonia",
  "Esuatini",
  "Etiopía",
  "Fiyi",
  "Filipinas",
  "Finlandia",
  "Francia",
  "Gabón",
  "Gambia",
  "Georgia",
  "Ghana",
  "Granada",
  "Grecia",
  "Guatemala",
  "Guinea",
  "Guinea-Bisáu",
  "Guinea Ecuatorial",
  "Guyana",
  "Haití",
  "Honduras",
  "Hungría",
  "India",
  "Indonesia",
  "Irak",
  "Irán",
  "Irlanda",
  "Islandia",
  "Islas Marshall",
  "Islas Salomón",
  "Israel",
  "Italia",
  "Jamaica",
  "Japón",
  "Jordania",
  "Kazajistán",
  "Kenia",
  "Kirguistán",
  "Kiribati",
  "Kuwait",
  "Laos",
  "Lesoto",
  "Letonia",
  "Líbano",
  "Liberia",
  "Libia",
  "Liechtenstein",
  "Lituania",
  "Luxemburgo",
  "Madagascar",
  "Malasia",
  "Malaui",
  "Maldivas",
  "Malí",
  "Malta",
  "Marruecos",
  "Mauricio",
  "Mauritania",
  "México",
  "Micronesia",
  "Moldavia",
  "Mónaco",
  "Mongolia",
  "Montenegro",
  "Mozambique",
  "Namibia",
  "Nauru",
  "Nepal",
  "Nicaragua",
  "Níger",
  "Nigeria",
  "Noruega",
  "Nueva Zelanda",
  "Omán",
  "Países Bajos",
  "Pakistán",
  "Palaos",
  "Panamá",
  "Papúa Nueva Guinea",
  "Paraguay",
  "Perú",
  "Polonia",
  "Portugal",
  "Reino Unido",
  "República Centroafricana",
  "República Checa",
  "República del Congo",
  "República Democrática del Congo",
  "República Dominicana",
  "Ruanda",
  "Rumanía",
  "Rusia",
  "Samoa",
  "San Cristóbal y Nieves",
  "San Marino",
  "San Vicente y las Granadinas",
  "Santa Lucía",
  "Santo Tomé y Príncipe",
  "Senegal",
  "Serbia",
  "Seychelles",
  "Sierra Leona",
  "Singapur",
  "Siria",
  "Somalia",
  "Sri Lanka",
  "Sudáfrica",
  "Sudán",
  "Sudán del Sur",
  "Suecia",
  "Suiza",
  "Surinam",
  "Tailandia",
  "Tanzania",
  "Tayikistán",
  "Timor Oriental",
  "Togo",
  "Tonga",
  "Trinidad y Tobago",
  "Túnez",
  "Turkmenistán",
  "Turquía",
  "Tuvalu",
  "Ucrania",
  "Uganda",
  "Uruguay",
  "Uzbekistán",
  "Vanuatu",
  "Venezuela",
  "Vietnam",
  "Yemen",
  "Yibuti",
  "Zambia",
  "Zimbabue",
];

/* Catálogo grande de profesiones y oficios */
const PROFESIONES_OFICIOS = [
  // Administración y oficina
  "Administrador/a",
  "Asistente administrativo/a",
  "Secretaria/o",
  "Recepcionista",
  "Archivista",
  "Oficinista",
  "Gerente de Recursos Humanos",
  "Gerente General",
  "Supervisor/a",
  // Contabilidad, finanzas y leyes
  "Contador/a",
  "Auxiliar contable",
  "Auditor/a",
  "Analista financiero",
  "Cajero/a",
  "Abogado/a",
  "Notario/a",
  "Juez / Jueza",
  "Fiscal",
  "Asesor/a legal",
  // Salud
  "Médico/a General",
  "Médico/a Especialista",
  "Cirujano/a",
  "Odontólogo/a (Dentista)",
  "Enfermero/a",
  "Auxiliar de enfermería",
  "Paramédico/a",
  "Técnico/a en Laboratorio Clínico",
  "Farmacéutico/a",
  "Nutricionista",
  "Fisioterapeuta",
  "Psicólogo/a",
  "Trabajador/a Social en Salud",
  "Veterinario/a",
  // Educación
  "Docente de Prebásica",
  "Docente de Educación Básica",
  "Docente de Secundaria",
  "Profesor/a Universitario/a",
  "Tutor/a",
  "Orientador/a Educativo/a",
  "Pedagogo/a",
  "Psicopedagogo/a",
  // Tecnología e informática
  "Ingeniero/a en Sistemas",
  "Desarrollador/a de Software",
  "Programador/a",
  "Analista de Sistemas",
  "Administrador/a de Bases de Datos",
  "Administrador/a de Redes",
  "Soporte Técnico",
  "Técnico/a en Informática",
  "Especialista en Ciberseguridad",
  "Diseñador/a Web",
  "Tester / QA",
  // Ingeniería
  "Ingeniero/a Civil",
  "Ingeniero/a Industrial",
  "Ingeniero/a Eléctrico",
  "Ingeniero/a Mecánico",
  "Ingeniero/a Electrónico",
  "Ingeniero/a Agrónomo",
  "Ingeniero/a Ambiental",
  "Ingeniero/a Químico",
  "Ingeniero/a en Telecomunicaciones",
  // Seguridad y fuerzas del orden
  "Guardia de Seguridad",
  "Policía",
  "Militar",
  "Bombero/a",
  "Inspector/a de Seguridad",
  "Vigilante",
  // Comercio y ventas
  "Vendedor/a",
  "Ejecutivo/a de Ventas",
  "Representante Comercial",
  "Mercadólogo/a",
  "Promotor/a",
  "Dependiente de tienda",
  "Encargado/a de Bodega",
  "Logístico/a",
  // Construcción y oficios técnicos
  "Albañil",
  "Carpintero/a",
  "Plomero / Fontanero",
  "Electricista",
  "Soldador/a",
  "Pintor/a",
  "Herrero/a",
  "Yesero/a",
  "Maestro de Obras",
  "Topógrafo/a",
  // Transporte
  "Chofer",
  "Taxista",
  "Conductor de Bus",
  "Conductor de Camión",
  "Piloto",
  "Ayudante de Transporte",
  "Coordinador de Transporte",
  // Servicios y atención al cliente
  "Mesero/a",
  "Cocinero/a",
  "Chef",
  "Barista",
  "Bartender",
  "Recepcionista de Hotel",
  "Camarero/a de Hotel",
  "Personal de Limpieza",
  "Conserje",
  "Estilista",
  "Barbero",
  "Manicurista / Pedicurista",
  // Comunicación, arte y medios
  "Periodista",
  "Reportero/a",
  "Locutor/a",
  "Comunicador/a Social",
  "Diseñador/a Gráfico",
  "Fotógrafo/a",
  "Camarógrafo/a",
  "Editor/a de Video",
  "Músico/a",
  "Actor / Actriz",
  "Productor/a Audiovisual",
  // Campo, producción y otros
  "Agricultor/a",
  "Ganadero/a",
  "Jornalero/a",
  "Jardinero/a",
  "Operador/a de Maquinaria",
  "Obrero/a de Fábrica",
  "Panadero/a",
  "Carnicero/a",
  "Empresario/a",
  "Comerciante",
  "Trabajador/a Independiente",
  "Ama de Casa",
  "Estudiante",
  "Desempleado/a",
  "Otro",
];

/* ===================== Helpers ===================== */
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

/** Parse seguro de "YYYY-MM-DD" a Date (sin problema de zona horaria) */
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
function mapUserToFormSafe(api = {}) {
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
      .map((r) => (typeof r === "string" ? r : r?.code || r?.name || r?.nombre || ""))
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
  const civilOk = ESTADOS_CIVILES.includes(civil) ? civil : "";

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
      [
        "dni",
        "documento",
        "num_documento",
        "numeroDocumento",
        "persona.dni",
        "persona.numeroDocumento",
      ],
      ""
    ),
    estadoCivil: civilOk,
    fechaNacimiento: toDateInputSafe(fechaRaw),
    paisNacimiento: getVal(
      api,
      [
        "paisNacimiento",
        "pais_nacimiento",
        "countryOfBirth",
        "persona.pais",
        "datosNacimiento.pais",
        "nacimiento.pais",
      ],
      ""
    ),
    ciudadNacimiento: getVal(
      api,
      [
        "ciudadNacimiento",
        "ciudad_nacimiento",
        "cityOfBirth",
        "persona.ciudad",
        "datosNacimiento.ciudad",
        "nacimiento.ciudad",
      ],
      ""
    ),
    municipioNacimiento: getVal(
      api,
      [
        "municipioNacimiento",
        "municipio",
        "persona.municipio",
        "datosNacimiento.municipio",
        "nacimiento.municipio",
        "ubicacion.municipio",
      ],
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
      [
        "telefono",
        "phone",
        "celular",
        "tel",
        "telefono1",
        "telefono2",
        "persona.telefono",
        "persona.celular",
        "contacto.telefono",
      ],
      ""
    ),
    domicilio: getVal(
      api,
      [
        "domicilio",
        "direccion",
        "address",
        "direccionResidencia",
        "persona.direccion",
        "persona.domicilio",
        "ubicacion.direccion",
      ],
      ""
    ),
    // IAM
    roles,
    active,
    id_persona: getVal(api, ["id_persona", "persona.id_persona"], null),
    _id: getVal(api, ["_id", "id", "persona._id"], undefined),
  };
}

function RoleBadges({ roles = [] }) {
  const uiNames = roles.map((r) => ROLE_MAP_DB_TO_UI[r] || r);
  return (
    <div className="flex flex-wrap gap-1">
      {uiNames.length === 0 ? (
        <span className="text-neutral-400">—</span>
      ) : (
        uiNames.map((r, i) => (
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
        className="w-full px-3 py-2 rounded-lg border border-cyan-500/40 bg-slate-950/60 text-left text-sm shadow-inner flex items-center gap-2"
      >
        <span>
          {selected.size === 0 ? "Seleccionar rol(es)" : Array.from(selected).join(", ")}
        </span>
        <span className="ml-auto text-xs opacity-70">▾</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-60 overflow-auto rounded-xl border border-cyan-500/40 bg-slate-950/95 shadow-[0_0_25px_rgba(34,211,238,0.35)]">
          {DISPLAY_ROLES.map((ui) => (
            <label
              key={ui}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-cyan-500/10 cursor-pointer"
            >
              <input
                type="checkbox"
                className="scale-110 accent-cyan-500"
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

/** Selector de país con fondo semitransparente y scroll + barra lateral ▲ ▼ */
function CountrySelect({ label, name, value, onChange }) {
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
          <div
            ref={listRef}
            className="flex-1 max-h-56 overflow-y-auto"
          >
            {COUNTRIES.map((c) => (
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

/** Selector de profesión con scroll, barra vertical ▲ ▼ y cierre automático */
function ProfessionSelect({ value, onChange }) {
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
          <div
            ref={listRef}
            className="flex-1 max-h-56 overflow-y-auto"
          >
            {PROFESIONES_OFICIOS.map((p) => (
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

function passwordRules(p = "") {
  return {
    length: p.length >= 8,
    upper: /[A-Z]/.test(p),
    lower: /[a-z]/.test(p),
    digit: /\d/.test(p),
  };
}

/* ========= NUEVO (helper robusto de mapeo) ========= */
function firstNonEmpty(...vals) {
  for (const v of vals) {
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return "";
}

function mapUserToForm(u = {}) {
  const p = u.persona || u.profile || {};
  return {
    nombreCompleto: firstNonEmpty(
      u.nombreCompleto,
      u.name,
      p.nombreCompleto,
      [p.nombres, p.apellidos].filter(Boolean).join(" ")
    ),
    tipoDni: firstNonEmpty(u.tipoDni, p.tipoDni, "Identidad"),
    dni: firstNonEmpty(u.dni, p.dni),
    estadoCivil: firstNonEmpty(u.estadoCivil, p.estadoCivil),
    fechaNacimiento: (firstNonEmpty(u.fechaNacimiento, p.fechaNacimiento) || "")
      .toString()
      .slice(0, 10),
    paisNacimiento: firstNonEmpty(u.paisNacimiento, p.paisNacimiento),
    ciudadNacimiento: firstNonEmpty(u.ciudadNacimiento, p.ciudadNacimiento),
    municipioNacimiento: firstNonEmpty(u.municipioNacimiento, p.municipioNacimiento),
    correoPersona: firstNonEmpty(u.correoPersona, u.email, p.correoPersona),
    profesion: firstNonEmpty(u.profesion, p.profesion),
    lugarTrabajo: firstNonEmpty(u.lugarTrabajo, p.lugarTrabajo),
    telefono: firstNonEmpty(u.telefono, p.telefono, u.phone),
    domicilio: firstNonEmpty(u.domicilio, p.domicilio),
    roles: Array.isArray(u.roles) ? u.roles : Array.isArray(u.role) ? u.role : [],
    active: u.active !== false,
  };
}

/** Calendario para fecha de nacimiento con selección de día/mes/año */
function BirthDatePicker({ label, name, value, onChange }) {
  const [open, setOpen] = useState(false);
  const parsed = value ? parseDateYMD(value) || new Date() : new Date();
  const [viewDate, setViewDate] = useState(parsed);

  const selectedDate = value ? parseDateYMD(value) : null;

  const months = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
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
            {daysShort.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 text-sm">
            {cells.map((day, idx) => {
              if (!day) return <div key={idx} className="h-8" />;
              const isSelected =
                selectedDate &&
                selectedDate.getFullYear() === year &&
                selectedDate.getMonth() === month &&
                selectedDate.getDate() === day;

              return (
                <button
                  key={idx}
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

export default function UsersPage() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

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

  const filteredAll = useMemo(() => {
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
    if (onlyActive) res = res.filter((u) => u.active !== false);
    return res;
  }, [items, q, onlyActive]);

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  const [errors, setErrors] = useState({});

  function validate() {
    const e = {};
    if (!form.nombreCompleto) e.nombreCompleto = "Nombre completo requerido";
    if (!form.dni) e.dni = "Documento requerido";
    if (form.correoPersona && !/^\S+@\S+\.\S+$/.test(form.correoPersona))
      e.correoPersona = "Correo inválido";
    if (form.telefono && !/^[\d\+\-\s]{7,20}$/.test(form.telefono))
      e.telefono = "Teléfono inválido";

    const wantsPassword = !!(creds.password || creds.confirm || creds.sendVerification);
    if (wantsPassword) {
      const r = passwordRules(creds.password);
      if (!r.length || !r.upper || !r.lower || !r.digit)
        e.password = "Debe tener 8+ caracteres, mayúscula, minúscula y número.";
      if (!creds.password || !match) e.confirm = "La confirmación no coincide.";
      if (creds.sendVerification && !/^\S+@\S+\.\S+$/.test(form.correoPersona || ""))
        e.correoPersona = "Correo requerido/válido para enviar verificación.";
    }
    return e;
  }

  async function triggerVerification(userId, email) {
    if (!/^\S+@\S+\.\S+$/.test(email || ""))
      throw new Error("Correo inválido para verificación");
    if (typeof iamApi.sendVerificationEmail === "function") {
      return await iamApi.sendVerificationEmail(userId, email);
    } else if (typeof iamApi.sendVerification === "function") {
      return await iamApi.sendVerification({ userId, email });
    } else {
      throw new Error("La API de verificación no está implementada en iamApi");
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length) {
      const firstKey = Object.keys(v)[0];
      document.querySelector(`[name="${firstKey}"]`)?.focus?.();
      return;
    }

    try {
      setSubmitting(true);
      const payload = { ...form };
      if (creds.password) payload.password = creds.password;
      payload.sendVerification = !!creds.sendVerification;

      let res;
      let savedId = editing;

      if (editing) {
        res = await iamApi.updateUser(editing, payload);
        savedId = res?._id || res?.id || res?.userId || res?.data?._id || savedId;
        alert("Usuario actualizado correctamente");
      } else {
        res = await iamApi.createUser(payload);
        savedId =
          res?._id ||
          res?.id ||
          res?.userId ||
          res?.data?._id ||
          res?.data?.item?._id;
        alert("Usuario creado correctamente ✅");
      }

      if (creds.sendVerification) {
        try {
          if (!savedId) throw new Error("No se obtuvo el id del usuario guardado");
          await triggerVerification(savedId, form.correoPersona);
          alert("Se envió el correo de verificación a " + form.correoPersona);
        } catch (ev) {
          console.warn("[UsersPage] verificación no enviada:", ev);
          alert(
            "⚠️ No se pudo enviar la verificación: " +
              (ev?.message || "revisa el backend")
          );
        }
      }

      setForm(empty);
      setEditing(null);
      setCreds({ password: "", confirm: "", sendVerification: false });
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
      if (u.active === false) await iamApi.enableUser(u._id);
      else await iamApi.disableUser(u._id);
      await load();
    } catch (e) {
      alert(e?.message || "No se pudo cambiar el estado");
    }
  }

  async function startEdit(u) {
    console.log("[UsersPage] entrar a edición:", u);
    setEditing(u._id);
    setCreds({ password: "", confirm: "", sendVerification: false });

    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => firstFieldRef.current?.focus?.(), 120);

    try {
      setLoading(true);
      let full = u;

      if (typeof iamApi.getUser === "function") {
        const r = await iamApi.getUser(u._id);
        full = r?.item || r?.user || r || u;
      } else if (typeof iamApi.getUserById === "function") {
        const res = await iamApi.getUserById(u._id);
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

      try {
        setForm(mapUserToFormSafe(full));
      } catch {
        setForm(mapUserToForm(full));
      }
    } catch (e) {
      console.warn("[UsersPage] no se pudo obtener detalle; usando item de lista:", e);
      try {
        setForm(mapUserToFormSafe(u));
      } catch {
        setForm(mapUserToForm(u));
      }
    } finally {
      setLoading(false);
      setTimeout(() => firstFieldRef.current?.focus?.(), 120);
    }
  }

  function cancelEdit() {
    setEditing(null);
    setForm(empty);
    setCreds({ password: "", confirm: "", sendVerification: false });
    setErrors({});
  }

  async function handleDelete(u) {
    const nombre = u?.nombreCompleto || u?.name || "este usuario";
    const ok = window.confirm(
      `¿Seguro que deseas eliminar a ${nombre}? Esta acción no se puede deshacer.`
    );
    if (!ok) return;
    const prev = items;
    setItems((curr) => curr.filter((x) => x._id !== u._id));
    try {
      await iamApi.deleteUser(u._id);
      if (editing === u._id) cancelEdit();
      alert("Usuario eliminado correctamente.");
    } catch (e) {
      setItems(prev);
      alert(e?.message || "No se pudo eliminar el usuario");
    }
  }

  return (
    <div className="space-y-4">
      {Object.keys(errors).length > 0 && (
        <div className="rounded-md border border-amber-400 bg-amber-950/60 text-amber-100 px-3 py-2">
          Revisa los campos marcados en rojo.
        </div>
      )}

      {editing && (
        <div className="flex items-center justify-between rounded-xl border border-sky-500/50 bg-sky-900/40 text-sky-100 px-3 py-2 shadow-[0_0_20px_rgba(56,189,248,0.35)]">
          <div className="text-sm">
            <span className="font-semibold">Editando usuario</span>
            {form?.nombreCompleto ? `: ${form.nombreCompleto}` : ""}{" "}
            {form?.id_persona ? `(ID: ${form.id_persona})` : ""}
          </div>
          <button
            type="button"
            onClick={cancelEdit}
            className="px-3 py-1 rounded-lg border border-sky-400/70 text-xs hover:bg-sky-500/20"
          >
            Salir del modo edición
          </button>
        </div>
      )}

      {/* === 1) FORMULARIO ARRIBA === */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-cyan-500/40 bg-slate-950/70 backdrop-blur-sm p-4 md:p-6 shadow-[0_0_40px_rgba(34,211,238,0.35)] space-y-3"
      >
        <h3 className="font-semibold text-lg text-cyan-100">
          {editing ? "Editar usuario" : "Crear usuario"}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field
            label="Nombre completo"
            name="nombreCompleto"
            value={form.nombreCompleto ?? ""}
            onChange={setField}
            error={errors.nombreCompleto}
            required
            inputRef={firstFieldRef}
          />

          <div className="md:col-span-2">
            <span className="text-sm text-neutral-200">Documento</span>
            <div className="flex gap-2 mt-1">
              <select
                className="px-3 py-2 rounded-lg border border-cyan-500/40 bg-slate-950/70 text-sm"
                value={form.tipoDni ?? "Identidad"}
                onChange={(e) => setField("tipoDni", e.target.value)}
              >
                <option>Identidad</option>
                <option>Pasaporte</option>
              </select>
              <input
                name="dni"
                className="flex-1 px-3 py-2 rounded-lg border border-cyan-500/40 bg-slate-950/70 text-sm"
                value={form.dni ?? ""}
                onChange={(e) => setField("dni", e.target.value)}
                placeholder="0801-0000-00000"
                required
              />
            </div>
            {errors.dni && (
              <p className="text-red-400 text-xs mt-1">{errors.dni}</p>
            )}
          </div>

          <Select
            label="Estado civil"
            name="estadoCivil"
            value={form.estadoCivil ?? ""}
            onChange={setField}
            options={ESTADOS_CIVILES}
          />

          <BirthDatePicker
            label="Fecha de nacimiento"
            name="fechaNacimiento"
            value={form.fechaNacimiento ?? ""}
            onChange={setField}
          />

          <CountrySelect
            label="País nacimiento"
            name="paisNacimiento"
            value={form.paisNacimiento ?? ""}
            onChange={setField}
          />

          <Field
            label="Ciudad nacimiento"
            name="ciudadNacimiento"
            value={form.ciudadNacimiento ?? ""}
            onChange={setField}
          />

          <Field
            label="Municipio"
            name="municipioNacimiento"
            value={form.municipioNacimiento ?? ""}
            onChange={setField}
          />

          <label className="space-y-1">
            <span className="text-sm text-neutral-200">Profesión u oficio</span>
            <ProfessionSelect
              value={form.profesion ?? ""}
              onChange={(val) => setField("profesion", val)}
            />
          </label>

          <Field
            label="Lugar de trabajo"
            name="lugarTrabajo"
            value={form.lugarTrabajo ?? ""}
            onChange={setField}
          />

          <Field
            label="Teléfono"
            name="telefono"
            value={form.telefono ?? ""}
            onChange={setField}
            placeholder="(+504) 9999-9999"
          />

          <Field
            className="md:col-span-2"
            label="Domicilio actual"
            name="domicilio"
            value={form.domicilio ?? ""}
            onChange={setField}
          />

          <label className="space-y-1 md:col-span-2">
            <span className="text-sm text-neutral-200">Rol del usuario</span>
            <RoleSelect
              value={form.roles}
              onChange={(rolesDb) => setField("roles", rolesDb)}
            />
          </label>
        </div>

        {/* CREDENCIALES */}
        <section className="mt-3 space-y-2 border-t border-cyan-500/30 pt-3">
          <h4 className="font-semibold text-sm tracking-wide text-cyan-100">
            Credenciales de acceso
          </h4>

          {/* Correo electrónico (oscuro, sin franja blanca) */}
          <label className="space-y-1">
            <span className="text-sm text-neutral-200">Correo electrónico</span>
            <input
              name="correoPersona"
              type="email"
              autoComplete="off"
              className="w-full px-3 py-2 rounded-lg border border-cyan-500/40 bg-slate-950/70 text-sm text-neutral-100 placeholder:text-neutral-500"
              value={form.correoPersona ?? ""}
              onChange={(e) => setField("correoPersona", e.target.value)}
              placeholder="usuario@ejemplo.com"
            />
            {errors.correoPersona && (
              <span className="text-xs text-red-400">
                {errors.correoPersona}
              </span>
            )}
          </label>

          {/* Contraseña */}
          <label className="space-y-1 block">
            <span className="text-sm text-neutral-200">Contraseña</span>
            <div className="flex items-center gap-2">
              <input
                type={showPwd ? "text" : "password"}
                className="w-full px-3 py-2 rounded-lg border border-cyan-500/40 bg-slate-950/70 text-sm"
                value={creds.password}
                onChange={(e) =>
                  setCreds((c) => ({ ...c, password: e.target.value }))
                }
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPwd((s) => !s)}
                className="px-3 py-2 rounded-lg border border-cyan-400/50 bg-cyan-500/20 text-xs hover:bg-cyan-500/30 transition"
              >
                {showPwd ? "Ocultar" : "Mostrar"}
              </button>
            </div>

            {errors.password && (
              <span className="text-xs text-red-400">{errors.password}</span>
            )}

            {showPwdRules && (
              <ul className="text-xs opacity-80 mt-1 grid grid-cols-2 gap-x-4 text-neutral-200">
                <li>{pwdR.length ? "✅" : "❌"} Mínimo 8 caracteres</li>
                <li>{pwdR.upper ? "✅" : "❌"} Una mayúscula</li>
                <li>{pwdR.lower ? "✅" : "❌"} Una minúscula</li>
                <li>{pwdR.digit ? "✅" : "❌"} Un número</li>
              </ul>
            )}
          </label>

          {/* Confirmar contraseña */}
          <label className="space-y-1 block">
            <span className="text-sm text-neutral-200">
              Confirmar contraseña
            </span>
            <div className="flex items-center gap-2">
              <input
                type={showPwd ? "text" : "password"}
                className="w-full px-3 py-2 rounded-lg border border-cyan-500/40 bg-slate-950/70 text-sm"
                value={creds.confirm}
                onChange={(e) =>
                  setCreds((c) => ({ ...c, confirm: e.target.value }))
                }
                placeholder="••••••••"
              />
            </div>

            {errors.confirm && (
              <span className="text-xs text-red-400">{errors.confirm}</span>
            )}
            {!errors.confirm &&
              creds.confirm &&
              creds.password !== creds.confirm && (
                <span className="text-xs text-red-400">
                  No coincide con la contraseña.
                </span>
              )}
          </label>

          {/* Enviar verificación */}
          <label className="flex items-center gap-2 text-sm text-neutral-200">
            <input
              type="checkbox"
              className="accent-cyan-500"
              checked={!!creds.sendVerification}
              onChange={async (e) => {
                const checked = e.target.checked;
                setCreds((c) => ({ ...c, sendVerification: checked }));
                if (
                  checked &&
                  editing &&
                  /^\S+@\S+\.\S+$/.test(form.correoPersona || "")
                ) {
                  try {
                    setSubmitting(true);
                    await triggerVerification(editing, form.correoPersona);
                    alert(
                      "Se envió el correo de verificación a " + form.correoPersona
                    );
                  } catch (ev) {
                    console.warn(
                      "[UsersPage] verificación inmediata falló:",
                      ev
                    );
                    alert(
                      "⚠️ No se pudo enviar verificación ahora: " +
                        (ev?.message || "se enviará al guardar")
                    );
                  } finally {
                    setSubmitting(false);
                  }
                }
              }}
            />
            <span>Enviar correo de verificación</span>
          </label>
        </section>

        <div className="flex items-center justify-between flex-wrap gap-3 pt-2 border-t border-cyan-500/30 mt-2">
          <label className="flex items-center gap-2 text-sm text-neutral-200">
            <input
              type="checkbox"
              className="accent-emerald-500"
              checked={!!form.active}
              onChange={(e) => setField("active", e.target.checked)}
            />
            <span>Activo</span>
          </label>

          <div className="flex gap-2">
            {editing && (
              <button
                type="button"
                onClick={cancelEdit}
                className="px-3 py-2 rounded-lg border border-neutral-500/60 text-sm hover:bg-neutral-800/70"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className={`px-4 py-2 rounded-lg text-sm font-medium border border-cyan-400/70 ${
                submitting
                  ? "opacity-60 cursor-not-allowed bg-slate-800 text-neutral-200"
                  : "bg-cyan-500/90 text-slate-950 hover:bg-cyan-400"
              }`}
            >
              {submitting
                ? editing
                  ? "Guardando..."
                  : "Creando..."
                : editing
                ? "Guardar cambios"
                : "Crear"}
            </button>
          </div>
        </div>
      </form>

      {/* === 2) LISTA DE USUARIOS === */}
      <section className="rounded-2xl border border-cyan-500/40 bg-slate-950/70 backdrop-blur-sm shadow-[0_0_40px_rgba(34,211,238,0.35)] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-500/30">
          <div className="space-y-1">
            <h4 className="font-semibold text-sm text-cyan-100">
              Usuarios registrados
            </h4>
            <div className="flex items-center gap-3 text-xs text-neutral-300">
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  className="accent-cyan-500"
                  checked={onlyActive}
                  onChange={(e) => setOnlyActive(e.target.checked)}
                />
                Solo activos
              </label>
              <span>
                Total: {filteredAll.length}/{items.length}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 text-xs">
            <input
              placeholder="Buscar por nombre, correo, DNI…"
              className="px-2 py-1 rounded-lg border border-cyan-500/40 bg-slate-950/70 text-xs w-56"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-12 gap-2 bg-slate-950/80 px-4 py-2 font-semibold text-[11px] text-neutral-200">
          <div className="col-span-4">Usuario</div>
          <div className="col-span-4">Roles</div>
          <div className="col-span-2">Estado</div>
          <div className="col-span-2 flex items-center justify-end gap-2">
            <span>Acciones</span>

            <button
              type="button"
              onClick={() => setVisibleCount((c) => Math.max(STEP, c - STEP))}
              disabled={visibleCount <= STEP}
              title="Ver menos"
              className="h-6 w-6 rounded-full border border-neutral-500/80 disabled:opacity-40 text-xs flex items-center justify-center bg-slate-900/80"
            >
              –
            </button>

            <button
              type="button"
              onClick={() =>
                setVisibleCount((c) =>
                  Math.min(filteredAll.length, c + STEP)
                )
              }
              disabled={visibleCount >= filteredAll.length}
              title="Ver más"
              className="h-6 w-6 rounded-full border border-neutral-500/80 disabled:opacity-40 text-xs flex items-center justify-center bg-slate-900/80"
            >
              +
            </button>

            <span className="opacity-70 text-[11px]">
              {Math.min(visibleCount, filteredAll.length)}/{filteredAll.length}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="p-4 text-sm text-neutral-200">Cargando…</div>
        ) : err ? (
          <div className="p-4 text-sm text-red-300">{err}</div>
        ) : filteredAll.length === 0 ? (
          <div className="p-6 text-sm text-neutral-400 text-center">
            Sin usuarios.
          </div>
        ) : (
          <div className="max-h-[480px] overflow-auto">
            {filteredAll.slice(0, visibleCount).map((u) => (
              <div
                key={u._id}
                className="grid grid-cols-12 gap-2 px-4 py-3 border-t border-slate-800/80 text-sm text-neutral-100 hover:bg-slate-900/70"
              >
                <div className="col-span-4">
                  <div className="font-medium">
                    {u.nombreCompleto || u.name || "—"}
                  </div>
                  {u.id_persona != null && (
                    <div className="mt-1">
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-900 border border-neutral-600 text-neutral-200">
                        ID: {u.id_persona}
                      </span>
                    </div>
                  )}
                  <div className="text-xs text-neutral-300 mt-1">
                    {u.correoPersona || "—"}
                  </div>
                  {u.dni && (
                    <div className="text-[11px] text-neutral-400">
                      DNI: {u.dni}
                    </div>
                  )}
                </div>

                <div className="col-span-4">
                  <RoleBadges roles={u.roles} />
                </div>

                <div className="col-span-2 flex items-center">
                  {u.active === false ? (
                    <span className="text-[11px] px-2 py-1 rounded-full bg-red-900/50 text-red-200 border border-red-500/50">
                      Inactivo
                    </span>
                  ) : (
                    <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-900/50 text-emerald-200 border border-emerald-500/50">
                      Activo
                    </span>
                  )}
                </div>

                <div className="col-span-2 flex items-center justify-end gap-2">
                  <button
                    onClick={() => startEdit(u)}
                    title="Editar"
                    aria-label="Editar"
                    className="p-2 rounded-full bg-sky-500 hover:bg-sky-400 text-slate-950最低 shadow"
                  >
                    <Edit3 size={16} />
                  </button>

                  <button
                    onClick={() => toggleActive(u)}
                    title={u.active === false ? "Activar" : "Desactivar"}
                    aria-label={u.active === false ? "Activar" : "Desactivar"}
                    className={`p-2 rounded-full text-slate-950 shadow ${
                      u.active === false
                        ? "bg-emerald-500 hover:bg-emerald-400"
                        : "bg-neutral-300 hover:bg-neutral-200"
                    }`}
                  >
                    ⏻
                  </button>

                  <button
                    onClick={() => handleDelete(u)}
                    className="p-2 rounded-full bg-red-500 hover:bg-red-400 text-slate-950 shadow"
                    title="Eliminar usuario"
                    aria-label="Eliminar usuario"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** Field: acepta 'required' y 'inputRef' para foco controlado */
function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  className = "",
  error,
  placeholder,
  required = false,
  inputRef,
}) {
  return (
    <label className={`space-y-1 ${className}`}>
      <span className="text-sm text-neutral-200">{label}</span>
      <input
        ref={inputRef}
        name={name}
        type={type}
        className="w-full px-3 py-2 rounded-lg border border-cyan-500/40 bg-slate-950/70 text-sm"
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(name, e.target.value)}
        required={required}
      />
      {error && <span className="text-xs text-red-400">{error}</span>}
    </label>
  );
}

function Select({ label, name, value, onChange, options = [] }) {
  return (
    <label className="space-y-1">
      <span className="text-sm text-neutral-200">{label}</span>
      <select
        name={name}
        className="w-full px-3 py-2 rounded-lg border border-cyan-500/40 bg-slate-950/70 text-sm"
        value={value ?? ""}
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
