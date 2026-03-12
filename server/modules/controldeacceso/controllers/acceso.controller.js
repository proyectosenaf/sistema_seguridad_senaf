// server/modules/acceso/controllers/acceso.controller.js
import Empleado from "../models/Empleado.js";
import Vehiculo from "../models/Vehiculo.js";
import MovimientoVehiculo from "../models/MovimientoVehiculo.js";
import MovimientoManual from "../models/MovimientoManual.js";

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
    res.status(201).json({ ok: true, item: emp });
  } catch (err) {
    console.error("[acceso] crearEmpleado", err);
    res.status(400).json({ ok: false, error: err.message });
  }
}

export async function actualizarEmpleado(req, res) {
  try {
    const { id } = req.params;

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

    if (!emp) {
      return res
        .status(404)
        .json({ ok: false, error: "Empleado no encontrado" });
    }

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

    const emp = await Empleado.findByIdAndUpdate(
      id,
      { $set: { activo: !!activo } },
      { new: true }
    );

    if (!emp) {
      return res
        .status(404)
        .json({ ok: false, error: "Empleado no encontrado" });
    }

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

    if (typeof enEmpresa === "boolean") {
      veh.enEmpresa = enEmpresa;
    } else {
      veh.enEmpresa = !veh.enEmpresa;
    }

    veh.ultimoMovimiento = new Date();
    await veh.save();

    await MovimientoVehiculo.create({
      vehiculo: veh._id,
      empleado: veh.empleado?._id || null,
      tipo: "TOGGLE",
      estadoEnEmpresa: veh.enEmpresa,
      observacion,
      usuarioGuardia,
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
    models: ["Versa", "Frontier", "Sentra", "Kicks", "X-Trail", "Altima", "Navara"],
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