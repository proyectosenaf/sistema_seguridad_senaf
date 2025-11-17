// server/modules/acceso/controllers/acceso.controller.js
import Empleado from "../models/Empleado.js";
import Vehiculo from "../models/Vehiculo.js";
import MovimientoVehiculo from "../models/MovimientoVehiculo.js";

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
    const filter =
      soloActivos === "true" ? { activo: true } : {};

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

      // campos extra
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
      activo: typeof req.body.activo === "boolean" ? req.body.activo : undefined,

      dni: req.body.dni,
      fechaNacimiento: req.body.fechaNacimiento || null,
      sexo: req.body.sexo,
      direccion: req.body.direccion,
      telefono: req.body.telefono,
      cargo: req.body.cargo,
      fechaIngreso: req.body.fechaIngreso || null,
    };

    // quitar undefined para no pisar campos
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

/* ───────── Vehículos de empleados ───────── */

export async function crearVehiculo(req, res) {
  try {
    const veh = new Vehiculo({
      empleado: req.body.empleado, // _id de Empleado
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
    const { observacion = "", usuarioGuardia = "" } = req.body;

    const veh = await Vehiculo.findById(idVehiculo).populate("empleado");
    if (!veh) {
      return res
        .status(404)
        .json({ ok: false, error: "Vehículo no encontrado" });
    }

    veh.enEmpresa = !veh.enEmpresa;
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
