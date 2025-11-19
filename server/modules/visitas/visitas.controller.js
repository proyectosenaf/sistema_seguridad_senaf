// server/src/modules/visitas/visitas.controller.js


import Visita from "./visitas.model.js";

/**
 * GET /api/visitas
 * Lista de visitas (ingresos reales + historial)
 */
export async function getVisitas(req, res) {
  try {
    const visitas = await Visita.find({})
      .sort({ fechaEntrada: -1, createdAt: -1 })
      .lean();

    res.json({ ok: true, items: visitas });
  } catch (err) {
    console.error("[visitas] getVisitas", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * POST /api/visitas
 * Crear una visita tipo "Ingreso" directa (guardia registra cuando llega)
 */
export async function createVisita(req, res) {
  try {
    const {
      nombre,
      documento,
      empresa,
      empleado,
      motivo,
      telefono,
      correo,
      tipo, // "Ingreso" | "Agendada" (por compatibilidad)
      llegoEnVehiculo,
      vehiculo,
      citaAt,
    } = req.body;

    // 👇 Detectamos si realmente viene info de vehículo
    const hasVehiculo =
      vehiculo &&
      (
        (vehiculo.placa && String(vehiculo.placa).trim() !== "") ||
        (vehiculo.marca && String(vehiculo.marca).trim() !== "") ||
        (vehiculo.modelo && String(vehiculo.modelo).trim() !== "")
      );

    const visita = new Visita({
      nombre,
      documento,
      empresa: empresa || null,
      empleado: empleado || null,
      motivo,
      telefono: telefono || null,
      correo: correo || null,
      tipo: tipo || "Ingreso",
      // 🟢 Si el frontend manda llegoEnVehiculo lo respetamos,
      //    si no lo manda pero hay vehículo → true
      llegoEnVehiculo:
        typeof llegoEnVehiculo !== "undefined"
          ? !!llegoEnVehiculo
          : !!hasVehiculo,
      vehiculo: hasVehiculo
        ? {
            marca: vehiculo.marca || "",
            modelo: vehiculo.modelo || "",
            placa: (vehiculo.placa || "").toUpperCase(),
          }
        : null,
      citaAt: citaAt || null,
      // fechaEntrada: el pre("save") del modelo la llena si tipo = "Ingreso"
    });

    await visita.save();
    res.status(201).json({ ok: true, item: visita });
  } catch (err) {
    console.error("[visitas] createVisita", err);
    res.status(400).json({ ok: false, error: err.message });
  }
}

/**
 * PATCH /api/visitas/:id/cerrar
 * Cerrar visita (marcar salida / finalizada)
 */
export async function closeVisita(req, res) {
  try {
    const { id } = req.params;

    const visita = await Visita.findById(id);
    if (!visita) {
      return res
        .status(404)
        .json({ ok: false, error: "Visita no encontrada" });
    }

    if (!visita.fechaSalida) {
      visita.fechaSalida = new Date();
    }
    visita.estado = "Finalizada";

    await visita.save();

    res.json({ ok: true, item: visita });
  } catch (err) {
    console.error("[visitas] closeVisita", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * POST /api/citas
 * Crear una CITA (visita agendada futura)
 * (valida horario con enforceBusinessHours en el router)
 */
export async function createCita(req, res) {
  try {
    const {
      nombre,
      documento,
      empresa,
      empleado,
      motivo,
      telefono,
      correo,
      citaAt,        // fecha/hora de la cita
      llegoEnVehiculo,
      vehiculo,
    } = req.body;

    const hasVehiculo =
      vehiculo &&
      (
        (vehiculo.placa && String(vehiculo.placa).trim() !== "") ||
        (vehiculo.marca && String(vehiculo.marca).trim() !== "") ||
        (vehiculo.modelo && String(vehiculo.modelo).trim() !== "")
      );

    const visita = new Visita({
      nombre,
      documento,
      empresa: empresa || null,
      empleado: empleado || null,
      motivo,
      telefono: telefono || null,
      correo: correo || null,
      tipo: "Agendada",
      // el default de estado en el modelo: "Programada"
      citaAt: citaAt ? new Date(citaAt) : null,
      llegoEnVehiculo:
        typeof llegoEnVehiculo !== "undefined"
          ? !!llegoEnVehiculo
          : !!hasVehiculo,
      vehiculo: hasVehiculo
        ? {
            marca: vehiculo.marca || "",
            modelo: vehiculo.modelo || "",
            placa: (vehiculo.placa || "").toUpperCase(),
          }
        : null,
    });

    await visita.save();
    res.status(201).json({ ok: true, item: visita });
  } catch (err) {
    console.error("[visitas] createCita", err);
    res.status(400).json({ ok: false, error: err.message });
  }
}

/**
 * GET /api/citas
 * Listar citas programadas (Agenda)
 * Soporta:
 *  - ?day=YYYY-MM-DD
 *  - ?month=YYYY-MM
 */
export async function listCitas(req, res) {
  try {
    const { day, month } = req.query;

    const match = { tipo: "Agendada" };

    if (day) {
      const d = new Date(day);
      const start = new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        0,
        0,
        0
      );
      const end = new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate() + 1,
        0,
        0,
        0
      );
      match.citaAt = { $gte: start, $lt: end };
    } else if (month) {
      // month = "YYYY-MM"
      const [yyyy, mm] = month.split("-").map((x) => parseInt(x, 10));
      if (!isNaN(yyyy) && !isNaN(mm)) {
        const start = new Date(yyyy, mm - 1, 1, 0, 0, 0);
        const end = new Date(yyyy, mm, 1, 0, 0, 0);
        match.citaAt = { $gte: start, $lt: end };
      }
    }

    const citas = await Visita.find(match).sort({ citaAt: 1 }).lean();

    res.json({ ok: true, items: citas });
  } catch (err) {
    console.error("[visitas] listCitas", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * PATCH /api/citas/:id/checkin
 * Registrar check-in de una cita (la visita llegó)
 * → estado: "Dentro", fechaEntrada: now
 */
export async function checkinCita(req, res) {
  try {
    const { id } = req.params;

    const visita = await Visita.findById(id);
    if (!visita) {
      return res
        .status(404)
        .json({ ok: false, error: "Cita/visita no encontrada" });
    }

    visita.estado = "Dentro";
    if (!visita.fechaEntrada) {
      visita.fechaEntrada = new Date();
    }

    await visita.save();
    res.json({ ok: true, item: visita });
  } catch (err) {
    console.error("[visitas] checkinCita", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * 🔹 NUEVO
 * PATCH /api/citas/:id/estado
 * Actualiza el estado de la cita (en_revision, autorizada, denegada, cancelada, etc.)
 * para que se refleje también en la Agenda de Citas.
 */
export async function updateCitaEstado(req, res) {
  try {
    const { id } = req.params;
    const { estado } = req.body || {};

    if (!estado) {
      return res
        .status(400)
        .json({ ok: false, error: "Debe indicar un estado" });
    }

    const visita = await Visita.findById(id);
    if (!visita) {
      return res
        .status(404)
        .json({ ok: false, error: "Cita/visita no encontrada" });
    }

    // Solo cambiamos el estado; la validación de enum la hace mongoose
    visita.estado = estado;
    await visita.save();

    return res.json({ ok: true, item: visita });
  } catch (err) {
    console.error("[visitas] updateCitaEstado", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * GET /api/visitas/vehiculos-en-sitio
 * Vehículos de VISITANTES actualmente dentro de la empresa.
 * Usado por el módulo de Control de Acceso (Accesos.jsx).
 */
export async function listVehiculosVisitasEnSitio(req, res) {
  try {
    const visitas = await Visita.find({
      estado: "Dentro",
      llegoEnVehiculo: true, // 👈 requisito que quieres mantener
      $or: [
        // Esquema nuevo: objeto vehiculo con placa
        { "vehiculo.placa": { $exists: true, $ne: "" } },
        // Esquema viejo: campo placa suelto
        { placa: { $exists: true, $ne: "" } },
      ],
    })
      .sort({ fechaEntrada: -1, createdAt: -1 })
      .lean();

    const items = visitas.map((v) => {
      const veh = v.vehiculo;

      const marca =
        typeof veh === "string"
          ? veh
          : veh?.marca || "";

      const modelo =
        typeof veh === "string"
          ? ""
          : veh?.modelo || "";

      const placa = (veh && typeof veh === "object" && veh.placa) || v.placa || "";

      return {
        id: v._id.toString(),
        visitante: v.nombre,
        documento: v.documento,
        empresa: v.empresa,
        empleadoAnfitrion: v.empleado,
        vehiculoMarca: marca,
        vehiculoModelo: modelo,
        placa,
        horaEntrada: v.fechaEntrada,
      };
    });

    res.json({ ok: true, items });
  } catch (err) {
    console.error("[visitas] listVehiculosVisitasEnSitio", err);
    res.status(500).json({
      ok: false,
      error:
        err.message || "Error al obtener vehículos de visitas en sitio",
    });
  }
}

export default {
  getVisitas,
  createVisita,
  closeVisita,
  createCita,
  listCitas,
  checkinCita,
  listVehiculosVisitasEnSitio,
};
