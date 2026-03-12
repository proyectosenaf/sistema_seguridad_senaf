import Empleado from "../models/Empleado.js";
import Vehiculo from "../models/Vehiculo.js";

/* =========================================================
   CATÁLOGOS BASE
   ========================================================= */

const SEXOS = ["Femenino", "Masculino", "Otro"];
const ESTADOS_EMPLEADO = ["Activo", "Inactivo"];

const DEPARTAMENTOS_BASE = [
  "Ingeniería",
  "Ventas",
  "Administración",
  "Logística",
  "Seguridad",
];

const CARGOS_BASE = [
  "Guardia de seguridad",
  "Supervisor de seguridad",
  "Jefe de seguridad",
  "Operador de CCTV",
  "Recepcionista",
  "Administrativo",
  "Jefe de área",
  "Mantenimiento",
];

const MARCAS_VEHICULO_BASE = [
  "Toyota",
  "Honda",
  "Nissan",
  "Hyundai",
  "Kia",
  "Chevrolet",
  "Mazda",
  "Ford",
  "Mitsubishi",
  "Suzuki",
  "Volkswagen",
  "Mercedes-Benz",
  "BMW",
  "Audi",
  "Renault",
  "Peugeot",
  "Fiat",
  "Jeep",
  "Subaru",
  "Isuzu",
  "JAC",
  "Great Wall",
  "Changan",
  "Chery",
  "Otra",
];

const MODELOS_BASE_POR_MARCA = {
  Toyota: ["Corolla", "Hilux", "RAV4", "Yaris", "Prado", "Camry"],
  Honda: ["Civic", "CR-V", "Fit", "HR-V", "Accord"],
  Nissan: ["Versa", "Frontier", "Sentra", "Kicks", "X-Trail", "Altima", "Navara"],
  Hyundai: ["Elantra", "Tucson", "Santa Fe", "Accent", "Creta"],
  Kia: ["Rio", "Sportage", "Sorento", "Picanto"],
  Chevrolet: ["Aveo", "Onix", "Tracker", "Captiva", "Silverado", "Tahoe", "Camaro"],
  Mazda: ["Mazda 2", "Mazda 3", "CX-5", "CX-30", "BT-50"],
  Ford: ["Ranger", "Explorer", "Escape", "Fiesta", "F-150"],
  Mitsubishi: ["L200", "Outlander", "Montero Sport"],
  Suzuki: ["Swift", "Vitara", "Jimny"],
  Volkswagen: ["Jetta", "Gol", "Tiguan", "Amarok", "Golf"],
  "Mercedes-Benz": ["Clase C", "Clase E", "GLA"],
  BMW: ["Serie 3", "Serie 5", "X3", "X5"],
  Audi: ["A3", "A4", "Q3", "Q5"],
  Renault: ["Duster", "Koleos", "Logan"],
  Peugeot: ["208", "3008", "2008"],
  Fiat: ["Uno", "Argo", "Strada"],
  Jeep: ["Wrangler", "Renegade", "Cherokee"],
  Subaru: ["Impreza", "Forester", "Outback"],
  Isuzu: ["D-MAX"],
  JAC: ["JS2", "JS4", "T8"],
  "Great Wall": ["Wingle", "Poer"],
  Changan: ["CS15", "CS35", "CS55"],
  Chery: ["Tiggo 2", "Tiggo 4", "Tiggo 7"],
  Otra: [],
};

const TIPOS_VISITA = ["Personal", "Profesional"];

const TIPOS_CITA = [
  { value: "personal", label: "Personal" },
  { value: "profesional", label: "Profesional" },
];

const ESTADOS_CITA = [
  { value: "solicitada", label: "Solicitada" },
  { value: "en_revision", label: "En revisión" },
  { value: "autorizada", label: "Ingresada" },
  { value: "denegada", label: "Denegada" },
  { value: "cancelada", label: "Cancelada" },
];

/* =========================================================
   HELPERS
   ========================================================= */

function uniqSorted(values = []) {
  return Array.from(
    new Set(
      values.map((v) => String(v || "").trim()).filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
}

function mergeCatalog(base = [], dynamic = []) {
  return uniqSorted([...(base || []), ...(dynamic || [])]);
}

async function getDepartamentosDinamicos() {
  const items = await Empleado.distinct("departamento", {
    departamento: { $exists: true, $ne: "" },
  });
  return uniqSorted(items);
}

async function getCargosDinamicos() {
  const items = await Empleado.distinct("cargo", {
    cargo: { $exists: true, $ne: "" },
  });
  return uniqSorted(items);
}

async function getMarcasDinamicas() {
  const items = await Vehiculo.distinct("marca", {
    marca: { $exists: true, $ne: "" },
  });
  return uniqSorted(items);
}

async function getModelosDinamicosPorMarca() {
  const rows = await Vehiculo.find(
    {
      marca: { $exists: true, $ne: "" },
      modelo: { $exists: true, $ne: "" },
    },
    { marca: 1, modelo: 1, _id: 0 }
  ).lean();

  const out = {};

  for (const row of rows) {
    const marca = String(row?.marca || "").trim();
    const modelo = String(row?.modelo || "").trim();
    if (!marca || !modelo) continue;

    if (!out[marca]) out[marca] = new Set();
    out[marca].add(modelo);
  }

  const normalized = {};
  for (const [marca, set] of Object.entries(out)) {
    normalized[marca] = Array.from(set).sort((a, b) =>
      a.localeCompare(b, "es", { sensitivity: "base" })
    );
  }

  return normalized;
}

function mergeModelMaps(baseMap = {}, dynamicMap = {}) {
  const keys = new Set([
    ...Object.keys(baseMap || {}),
    ...Object.keys(dynamicMap || {}),
  ]);

  const result = {};
  for (const key of keys) {
    result[key] = uniqSorted([
      ...((baseMap && baseMap[key]) || []),
      ...((dynamicMap && dynamicMap[key]) || []),
    ]);
  }
  return result;
}

/* =========================================================
   ENDPOINTS QUE TU FRONTEND YA ESTÁ PIDIENDO
   ========================================================= */

export async function getAccesoSexos(_req, res) {
  return res.json({ ok: true, items: SEXOS });
}

export async function getAccesoEstados(_req, res) {
  return res.json({ ok: true, items: ESTADOS_EMPLEADO });
}

export async function getAccesoDepartamentos(_req, res) {
  try {
    const dinamicos = await getDepartamentosDinamicos();
    return res.json({
      ok: true,
      items: mergeCatalog(DEPARTAMENTOS_BASE, dinamicos),
    });
  } catch (err) {
    console.error("[catalogos] getAccesoDepartamentos", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "No se pudieron cargar departamentos",
    });
  }
}

export async function getAccesoCargos(_req, res) {
  try {
    const dinamicos = await getCargosDinamicos();
    return res.json({
      ok: true,
      items: mergeCatalog(CARGOS_BASE, dinamicos),
    });
  } catch (err) {
    console.error("[catalogos] getAccesoCargos", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "No se pudieron cargar cargos",
    });
  }
}

export async function getVehiculoMarcas(_req, res) {
  try {
    const dinamicas = await getMarcasDinamicas();
    return res.json({
      ok: true,
      items: mergeCatalog(MARCAS_VEHICULO_BASE, dinamicas),
    });
  } catch (err) {
    console.error("[catalogos] getVehiculoMarcas", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "No se pudieron cargar marcas",
    });
  }
}

export async function getVehiculoModelos(req, res) {
  try {
    const { marca } = req.query;

    const dinamicos = await getModelosDinamicosPorMarca();
    const merged = mergeModelMaps(MODELOS_BASE_POR_MARCA, dinamicos);

    if (marca) {
      return res.json({
        ok: true,
        items: merged[String(marca).trim()] || [],
      });
    }

    return res.json({
      ok: true,
      items: merged,
    });
  } catch (err) {
    console.error("[catalogos] getVehiculoModelos", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "No se pudieron cargar modelos",
    });
  }
}

export async function getVisitasTipos(_req, res) {
  return res.json({ ok: true, items: TIPOS_VISITA });
}

export async function getCitasTipos(_req, res) {
  return res.json({ ok: true, items: TIPOS_CITA });
}

export async function getCitasEstados(_req, res) {
  return res.json({ ok: true, items: ESTADOS_CITA });
}

export async function getAllCatalogos(_req, res) {
  try {
    const [departamentos, cargos, marcas, modelos] = await Promise.all([
      getDepartamentosDinamicos(),
      getCargosDinamicos(),
      getMarcasDinamicas(),
      getModelosDinamicosPorMarca(),
    ]);

    return res.json({
      ok: true,
      items: {
        acceso: {
          sexos: SEXOS,
          estados: ESTADOS_EMPLEADO,
          departamentos: mergeCatalog(DEPARTAMENTOS_BASE, departamentos),
          cargos: mergeCatalog(CARGOS_BASE, cargos),
        },
        vehiculos: {
          marcas: mergeCatalog(MARCAS_VEHICULO_BASE, marcas),
          modelosPorMarca: mergeModelMaps(MODELOS_BASE_POR_MARCA, modelos),
        },
        visitas: {
          tipos: TIPOS_VISITA,
        },
        citas: {
          tipos: TIPOS_CITA,
          estados: ESTADOS_CITA,
        },
      },
    });
  } catch (err) {
    console.error("[catalogos] getAllCatalogos", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "No se pudieron cargar los catálogos",
    });
  }
}