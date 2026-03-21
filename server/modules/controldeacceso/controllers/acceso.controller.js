// server/modules/acceso/controllers/acceso.controller.js
import Empleado from "../models/Empleado.js";
import Vehiculo from "../models/Vehiculo.js";
import MovimientoVehiculo from "../models/MovimientoVehiculo.js";
import MovimientoManual from "../models/MovimientoManual.js";
import { logBitacoraEvent } from "../../bitacora/services/bitacora.service.js";

/* ───────────────────────── Helpers bitácora ───────────────────────── */

function getActor(req) {
  return {
    actorId: req.user?.sub || req.user?._id || req.user?.id || "",
    actorEmail: req.user?.email || "",
    agente: req.user?.name || req.user?.email || "Sistema",
  };
}

function toPlain(doc) {
  if (!doc) return null;
  if (typeof doc.toObject === "function") return doc.toObject();
  return JSON.parse(JSON.stringify(doc));
}

async function auditAcceso(req, payload = {}) {
  const actor = getActor(req);

  await logBitacoraEvent({
    modulo: "Control de Acceso",
    tipo: "Acceso",
    accion: payload.accion || "CREAR",
    entidad: payload.entidad || "",
    entidadId: payload.entidadId || "",
    agente: payload.agente || actor.agente,
    actorId: actor.actorId,
    actorEmail: actor.actorEmail,
    titulo: payload.titulo || "",
    descripcion: payload.descripcion || "",
    prioridad: payload.prioridad || "Baja",
    estado: payload.estado || "Registrado",
    nombre: payload.nombre || "",
    empresa: payload.empresa || "Interno",
    source: payload.source || "acceso",
    ip: req.ip || "",
    userAgent: req.get("user-agent") || "",
    before: payload.before || null,
    after: payload.after || null,
    meta: payload.meta || {},
  });
}

/**
 * Crea un registro manual (entrada, salida o permiso).
 * Espera en el body: fechaHora, fechaFin (opcional), noRegresa, tipo,
 * personaId, persona (nombre), placa, observacion, departamento.
 */
export async function crearMovimientoManual(req, res) {
  try {
    const {
      fechaHora,
      fechaFin,
      noRegresa,
      tipo,
      personaId,
      persona,
      placa,
      observacion,
      departamento,
    } = req.body;

    const mov = new MovimientoManual({
      fechaHora: fechaHora ? new Date(fechaHora) : null,
      fechaFin: noRegresa ? null : fechaFin ? new Date(fechaFin) : null,
      noRegresa: !!noRegresa,
      tipo,
      personaId: personaId || null,
      persona,
      placa,
      observacion,
      departamento,
    });

    await mov.save();

    await auditAcceso(req, {
      accion: "CREAR",
      entidad: "MovimientoManual",
      entidadId: mov._id?.toString(),
      titulo: "Movimiento manual registrado",
      descripcion: `Movimiento manual tipo "${tipo || "N/D"}" de ${
        persona || "N/D"
      }. Placa: ${placa || "N/D"}. Departamento: ${
        departamento || "N/D"
      }. Observación: ${observacion || "Sin observación"}.`,
      estado: "Registrado",
      nombre: persona || "",
      source: "acceso-manual",
      after: toPlain(mov),
      meta: {
        tipo,
        placa,
        departamento,
        noRegresa: !!noRegresa,
        fechaHora: mov.fechaHora,
        fechaFin: mov.fechaFin,
      },
    });

    res.status(201).json({ ok: true, item: mov });
  } catch (err) {
    console.error("[acceso] crearMovimientoManual", err);
    res.status(400).json({ ok: false, error: err.message });
  }
}

/**
 * Lista los registros manuales con filtros opcionales:
 * ?personaId=…&departamento=…&desde=YYYY-MM-DD&hasta=YYYY-MM-DD&tipo=Entrada|Salida|Permiso
 * Si no se especifican filtros, devuelve todo.
 */
export async function listarMovimientosManual(req, res) {
  try {
    const { personaId, departamento, desde, hasta, tipo } = req.query;
    const filter = {};

    if (personaId) filter.personaId = personaId;
    if (departamento) filter.departamento = departamento;
    if (tipo) filter.tipo = tipo;

    if (desde || hasta) {
      filter.fechaHora = {};
      if (desde) filter.fechaHora.$gte = new Date(desde);
      if (hasta) {
        const dateUntil = new Date(hasta);
        dateUntil.setDate(dateUntil.getDate() + 1);
        filter.fechaHora.$lt = dateUntil;
      }
    }

    const items = await MovimientoManual.find(filter)
      .sort({ fechaHora: -1 })
      .lean();

    res.json({ ok: true, items });
  } catch (err) {
    console.error("[acceso] listarMovimientosManual", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

/* ───────── Empleados + Vehículos (lista combinada) ───────── */

export async function listarEmpleadosVehiculos(req, res) {
  try {
    const { soloActivos = "true" } = req.query;
    const matchEmp = soloActivos === "true" ? { activo: true } : {};
    const matchVeh = soloActivos === "true" ? { activo: true } : {};

    const empleados = await Empleado.aggregate([
      { $match: matchEmp },
      {
        $lookup: {
          from: "vehiculos",
          localField: "_id",
          foreignField: "empleado",
          as: "vehiculos",
          pipeline: [{ $match: matchVeh }, { $sort: { createdAt: -1 } }],
        },
      },
      { $sort: { nombreCompleto: 1 } },
    ]);

    res.json({ ok: true, items: empleados });
  } catch (err) {
    console.error("[acceso] listarEmpleadosVehiculos", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

/* ───────── Empleados CRUD ───────── */

export async function listarEmpleados(req, res) {
  try {
    const { soloActivos = "false" } = req.query;
    const filter = soloActivos === "true" ? { activo: true } : {};

    const items = await Empleado.find(filter)
      .sort({ nombreCompleto: 1 })
      .lean();

    res.json({ ok: true, items });
  } catch (err) {
    console.error("[acceso] listarEmpleados", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

export async function crearEmpleado(req, res) {
  try {
    const emp = new Empleado({
      idInterno: req.body.idInterno,
      nombreCompleto: req.body.nombreCompleto,
      departamento: req.body.departamento,
      foto_empleado: req.body.foto_empleado || null,
      activo: req.body.activo ?? true,

      dni: req.body.dni,
      fechaNacimiento: req.body.fechaNacimiento || null,
      sexo: req.body.sexo,
      direccion: req.body.direccion,
      telefono: req.body.telefono,
      cargo: req.body.cargo,
      fechaIngreso: req.body.fechaIngreso || null,
    });

    await emp.save();

    await auditAcceso(req, {
      accion: "CREAR",
      entidad: "Empleado",
      entidadId: emp._id?.toString(),
      titulo: "Empleado creado",
      descripcion: `Se creó el empleado ${emp.nombreCompleto || "N/D"} del departamento ${
        emp.departamento || "N/D"
      }.`,
      estado: emp.activo ? "Activo" : "Inactivo",
      nombre: emp.nombreCompleto || "",
      source: "empleados",
      after: toPlain(emp),
      meta: {
        dni: emp.dni || "",
        cargo: emp.cargo || "",
        departamento: emp.departamento || "",
      },
    });

    res.status(201).json({ ok: true, item: emp });
  } catch (err) {
    console.error("[acceso] crearEmpleado", err);
    res.status(400).json({ ok: false, error: err.message });
  }
}

export async function actualizarEmpleado(req, res) {
  try {
    const { id } = req.params;

    const before = await Empleado.findById(id);
    if (!before) {
      return res
        .status(404)
        .json({ ok: false, error: "Empleado no encontrado" });
    }

    const update = {
      idInterno: req.body.idInterno,
      nombreCompleto: req.body.nombreCompleto,
      departamento: req.body.departamento,
      foto_empleado: req.body.foto_empleado,
      activo:
        typeof req.body.activo === "boolean" ? req.body.activo : undefined,

      dni: req.body.dni,
      fechaNacimiento: req.body.fechaNacimiento || null,
      sexo: req.body.sexo,
      direccion: req.body.direccion,
      telefono: req.body.telefono,
      cargo: req.body.cargo,
      fechaIngreso: req.body.fechaIngreso || null,
    };

    Object.keys(update).forEach(
      (k) => update[k] === undefined && delete update[k]
    );

    const emp = await Empleado.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true }
    );

    await auditAcceso(req, {
      accion: "ACTUALIZAR",
      entidad: "Empleado",
      entidadId: emp._id?.toString(),
      titulo: "Empleado actualizado",
      descripcion: `Se actualizó el empleado ${emp.nombreCompleto || "N/D"}.`,
      estado: emp.activo ? "Activo" : "Inactivo",
      nombre: emp.nombreCompleto || "",
      source: "empleados",
      before: toPlain(before),
      after: toPlain(emp),
      meta: {
        dni: emp.dni || "",
        cargo: emp.cargo || "",
        departamento: emp.departamento || "",
      },
    });

    res.json({ ok: true, item: emp });
  } catch (err) {
    console.error("[acceso] actualizarEmpleado", err);
    res.status(400).json({ ok: false, error: err.message });
  }
}

export async function actualizarEmpleadoActivo(req, res) {
  try {
    const { id } = req.params;
    const { activo } = req.body;

    const before = await Empleado.findById(id);
    if (!before) {
      return res
        .status(404)
        .json({ ok: false, error: "Empleado no encontrado" });
    }

    const emp = await Empleado.findByIdAndUpdate(
      id,
      { $set: { activo: !!activo } },
      { new: true }
    );

    await auditAcceso(req, {
      accion: "ACTUALIZAR",
      entidad: "Empleado",
      entidadId: emp._id?.toString(),
      titulo: "Estado de empleado actualizado",
      descripcion: `El empleado ${emp.nombreCompleto || "N/D"} fue marcado como ${
        emp.activo ? "Activo" : "Inactivo"
      }.`,
      estado: emp.activo ? "Activo" : "Inactivo",
      nombre: emp.nombreCompleto || "",
      source: "empleados",
      before: toPlain(before),
      after: toPlain(emp),
      meta: {
        activo: !!emp.activo,
      },
    });

    res.json({ ok: true, item: emp });
  } catch (err) {
    console.error("[acceso] actualizarEmpleadoActivo", err);
    res.status(400).json({ ok: false, error: err.message });
  }
}

export async function eliminarEmpleado(req, res) {
  try {
    const { id } = req.params;

    const emp = await Empleado.findByIdAndDelete(id);
    if (!emp) {
      return res
        .status(404)
        .json({ ok: false, error: "Empleado no encontrado" });
    }

    await Vehiculo.deleteMany({ empleado: id });

    await auditAcceso(req, {
      accion: "ELIMINAR",
      entidad: "Empleado",
      entidadId: id,
      titulo: "Empleado eliminado",
      descripcion: `Se eliminó el empleado ${emp.nombreCompleto || "N/D"} y sus vehículos asociados.`,
      estado: "Eliminado",
      nombre: emp.nombreCompleto || "",
      source: "empleados",
      before: toPlain(emp),
      meta: {
        dni: emp.dni || "",
        departamento: emp.departamento || "",
      },
    });

    res.json({ ok: true, item: emp });
  } catch (err) {
    console.error("[acceso] eliminarEmpleado", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

/* ───────── Vehículos de empleados ───────── */

export async function crearVehiculo(req, res) {
  try {
    const veh = new Vehiculo({
      empleado: req.body.empleado,
      marca: req.body.marca,
      modelo: req.body.modelo,
      placa: (req.body.placa || "").toUpperCase(),
      enEmpresa: req.body.enEmpresa ?? true,
      activo: req.body.activo ?? true,
    });

    await veh.save();

    await auditAcceso(req, {
      accion: "CREAR",
      entidad: "Vehiculo",
      entidadId: veh._id?.toString(),
      titulo: "Vehículo creado",
      descripcion: `Se registró el vehículo ${veh.placa || "N/D"} (${veh.marca || "N/D"} ${
        veh.modelo || ""
      }).`,
      estado: veh.enEmpresa ? "Dentro" : "Fuera",
      nombre: veh.placa || "",
      source: "vehiculos",
      after: toPlain(veh),
      meta: {
        empleadoId: veh.empleado?.toString?.() || veh.empleado || "",
        marca: veh.marca || "",
        modelo: veh.modelo || "",
        placa: veh.placa || "",
        activo: !!veh.activo,
      },
    });

    res.status(201).json({ ok: true, item: veh });
  } catch (err) {
    console.error("[acceso] crearVehiculo", err);
    res.status(400).json({ ok: false, error: err.message });
  }
}

export async function toggleEnEmpresa(req, res) {
  try {
    const { idVehiculo } = req.params;
    const { observacion = "", usuarioGuardia = "", enEmpresa } = req.body;

    const veh = await Vehiculo.findById(idVehiculo).populate("empleado");
    if (!veh) {
      return res
        .status(404)
        .json({ ok: false, error: "Vehículo no encontrado" });
    }

    const beforeVeh = toPlain(veh);

    if (typeof enEmpresa === "boolean") {
      veh.enEmpresa = enEmpresa;
    } else {
      veh.enEmpresa = !veh.enEmpresa;
    }

    veh.ultimoMovimiento = new Date();
    await veh.save();

    const mov = await MovimientoVehiculo.create({
      vehiculo: veh._id,
      empleado: veh.empleado?._id || null,
      tipo: "TOGGLE",
      estadoEnEmpresa: veh.enEmpresa,
      observacion,
      usuarioGuardia,
    });

    await auditAcceso(req, {
      accion: "ACTUALIZAR",
      entidad: "MovimientoVehiculo",
      entidadId: mov._id?.toString(),
      agente:
        usuarioGuardia || req.user?.name || req.user?.email || "Guardia",
      titulo: "Movimiento de vehículo registrado",
      descripcion: `Vehículo ${
        veh.placa || "N/D"
      } cambiado a estado en empresa: ${
        veh.enEmpresa ? "Sí" : "No"
      }. Empleado: ${veh.empleado?.nombreCompleto || "N/D"}. Observación: ${
        observacion || "Sin observación"
      }.`,
      estado: veh.enEmpresa ? "Dentro" : "Fuera",
      nombre: veh.empleado?.nombreCompleto || veh.placa || "",
      source: "acceso-vehiculo",
      before: beforeVeh,
      after: toPlain(mov),
      meta: {
        vehiculoId: veh._id?.toString(),
        placa: veh.placa || "",
        empleadoId: veh.empleado?._id?.toString() || "",
        empleadoNombre: veh.empleado?.nombreCompleto || "",
        usuarioGuardia,
      },
    });

    res.json({ ok: true, item: veh });
  } catch (err) {
    console.error("[acceso] toggleEnEmpresa", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

/* ───────── Historial de movimientos ───────── */

export async function listarMovimientos(req, res) {
  try {
    const { vehiculo } = req.query;
    const match = vehiculo ? { vehiculo } : {};

    const items = await MovimientoVehiculo.find(match)
      .populate("vehiculo")
      .populate("empleado")
      .sort({ createdAt: -1 })
      .limit(300)
      .lean();

    res.json({ ok: true, items });
  } catch (err) {
    console.error("[acceso] listarMovimientos", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

/* ───────── Catálogos para frontend ───────── */

const VEHICLE_CATALOG = [
  {
    brand: "Toyota",
    models: ["Corolla", "Hilux", "RAV4", "Yaris", "Prado", "Camry"],
  },
  {
    brand: "Honda",
    models: ["Civic", "CR-V", "Fit", "HR-V", "Accord"],
  },
  {
    brand: "Nissan",
    models: [
      "Versa",
      "Frontier",
      "Sentra",
      "Kicks",
      "X-Trail",
      "Altima",
      "Navara",
    ],
  },
  {
    brand: "Hyundai",
    models: ["Elantra", "Tucson", "Santa Fe", "Accent", "Creta"],
  },
  {
    brand: "Kia",
    models: ["Rio", "Sportage", "Sorento", "Picanto"],
  },
  {
    brand: "Chevrolet",
    models: ["Aveo", "Onix", "Tracker", "Captiva", "Silverado", "Tahoe", "Camaro"],
  },
  {
    brand: "Mazda",
    models: ["Mazda 2", "Mazda 3", "CX-5", "CX-30", "BT-50"],
  },
  {
    brand: "Ford",
    models: ["Ranger", "Explorer", "Escape", "Fiesta", "F-150"],
  },
  {
    brand: "Mitsubishi",
    models: ["L200", "Outlander", "Montero Sport"],
  },
  {
    brand: "Suzuki",
    models: ["Swift", "Vitara", "Jimny"],
  },
  {
    brand: "Volkswagen",
    models: ["Jetta", "Gol", "Tiguan", "Amarok", "Golf"],
  },
  {
    brand: "Mercedes-Benz",
    models: ["Clase C", "Clase E", "GLA"],
  },
  {
    brand: "BMW",
    models: ["Serie 3", "Serie 5", "X3", "X5"],
  },
  {
    brand: "Audi",
    models: ["A3", "A4", "Q3", "Q5"],
  },
  {
    brand: "Renault",
    models: ["Duster", "Koleos", "Logan"],
  },
  {
    brand: "Peugeot",
    models: ["208", "3008", "2008"],
  },
  {
    brand: "Fiat",
    models: ["Uno", "Argo", "Strada"],
  },
  {
    brand: "Jeep",
    models: ["Wrangler", "Renegade", "Cherokee"],
  },
  {
    brand: "Subaru",
    models: ["Impreza", "Forester", "Outback"],
  },
  {
    brand: "Isuzu",
    models: ["D-MAX"],
  },
  {
    brand: "JAC",
    models: ["JS2", "JS4", "T8"],
  },
  {
    brand: "Great Wall",
    models: ["Wingle", "Poer"],
  },
  {
    brand: "Changan",
    models: ["CS15", "CS35", "CS55"],
  },
  {
    brand: "Chery",
    models: ["Tiggo 2", "Tiggo 4", "Tiggo 7"],
  },
  {
    brand: "Otra",
    models: [],
  },
];

const EMPLOYEE_CATALOG = {
  sexos: ["Femenino", "Masculino", "Otro"],
  estados: ["Activo", "Inactivo"],
  departamentos: [
    "Ingeniería",
    "Ventas",
    "Administración",
    "Logística",
    "Seguridad",
  ],
  cargos: [
    "Guardia de seguridad",
    "Supervisor de seguridad",
    "Jefe de seguridad",
    "Operador de CCTV",
    "Recepcionista",
    "Administrativo",
    "Jefe de área",
    "Mantenimiento",
  ],
};

export async function obtenerCatalogoVehiculos(req, res) {
  try {
    const yearFrom = Number(req.query.yearFrom || 2000);
    const yearTo = Number(req.query.yearTo || new Date().getFullYear());

    const items = VEHICLE_CATALOG.map((item) => ({
      brand: item.brand,
      models: item.models,
      years: Array.from(
        { length: Math.max(0, yearTo - yearFrom + 1) },
        (_, i) => yearFrom + i
      ),
    }));

    res.json({
      ok: true,
      items,
      meta: {
        yearFrom,
        yearTo,
      },
    });
  } catch (err) {
    console.error("[acceso] obtenerCatalogoVehiculos", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

export async function obtenerCatalogoEmpleados(req, res) {
  try {
    res.json({
      ok: true,
      item: EMPLOYEE_CATALOG,
    });
  } catch (err) {
    console.error("[acceso] obtenerCatalogoEmpleados", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

export async function obtenerCatalogosAcceso(req, res) {
  try {
    const yearFrom = 2000;
    const yearTo = new Date().getFullYear();

    const vehiculos = VEHICLE_CATALOG.map((item) => ({
      brand: item.brand,
      models: item.models,
      years: Array.from(
        { length: yearTo - yearFrom + 1 },
        (_, i) => yearFrom + i
      ),
    }));

    res.json({
      ok: true,
      item: {
        empleados: EMPLOYEE_CATALOG,
        vehiculos,
      },
    });
  } catch (err) {
    console.error("[acceso] obtenerCatalogosAcceso", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}