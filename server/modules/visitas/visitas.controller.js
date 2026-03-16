import Visita from "./visitas.model.js";

function isValidDate(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

function parseCitaAt(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return isValidDate(value) ? value : null;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  // YYYY-MM-DD
  const onlyDate = /^(\d{4})-(\d{2})-(\d{2})$/;
  const mDate = raw.match(onlyDate);
  if (mDate) {
    const yyyy = Number(mDate[1]);
    const mm = Number(mDate[2]);
    const dd = Number(mDate[3]);
    const dt = new Date(yyyy, mm - 1, dd, 0, 0, 0, 0);
    return isValidDate(dt) ? dt : null;
  }

  // YYYY-MM-DDTHH:mm o YYYY-MM-DDTHH:mm:ss (sin zona)
  const localDateTime =
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;
  const mLocal = raw.match(localDateTime);
  if (mLocal) {
    const yyyy = Number(mLocal[1]);
    const mm = Number(mLocal[2]);
    const dd = Number(mLocal[3]);
    const hh = Number(mLocal[4]);
    const mi = Number(mLocal[5]);
    const ss = Number(mLocal[6] || 0);
    const dt = new Date(yyyy, mm - 1, dd, hh, mi, ss, 0);
    return isValidDate(dt) ? dt : null;
  }

  const dt = new Date(raw);
  return isValidDate(dt) ? dt : null;
}

function parseLocalDayRange(day) {
  const raw = String(day || "").trim();
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;

  const yyyy = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);

  const start = new Date(yyyy, mm - 1, dd, 0, 0, 0, 0);
  const end = new Date(yyyy, mm - 1, dd + 1, 0, 0, 0, 0);

  if (!isValidDate(start) || !isValidDate(end)) return null;
  return { start, end };
}

function parseLocalMonthRange(month) {
  const raw = String(month || "").trim();
  const m = raw.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;

  const yyyy = Number(m[1]);
  const mm = Number(m[2]);

  const start = new Date(yyyy, mm - 1, 1, 0, 0, 0, 0);
  const end = new Date(yyyy, mm, 1, 0, 0, 0, 0);

  if (!isValidDate(start) || !isValidDate(end)) return null;
  return { start, end };
}

function normalizeEstado(value) {
  const raw = String(value || "").trim();
  if (!raw) return raw;

  const key = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "_");

  const map = {
    programada: "Programada",
    dentro: "Dentro",
    finalizada: "Finalizada",
    cancelada: "Cancelada",
    en_revision: "en_revision",
    revision: "en_revision",
    autorizada: "autorizada",
    autorizado: "autorizada",
    denegada: "denegada",
    denegado: "denegada",
  };

  return map[key] || raw;
}

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
    } = req.body || {};

    const nombreSafe = String(nombre || "").trim();
    const documentoSafe = String(documento || "").trim();
    const motivoSafe = String(motivo || "").trim();

    if (!nombreSafe) {
      return res.status(400).json({ ok: false, error: "nombre_required" });
    }
    if (!documentoSafe) {
      return res.status(400).json({ ok: false, error: "documento_required" });
    }
    if (!motivoSafe) {
      return res.status(400).json({ ok: false, error: "motivo_required" });
    }

    // Detectamos si realmente viene info de vehículo
    const hasVehiculo =
      vehiculo &&
      ((vehiculo.placa && String(vehiculo.placa).trim() !== "") ||
        (vehiculo.marca && String(vehiculo.marca).trim() !== "") ||
        (vehiculo.modelo && String(vehiculo.modelo).trim() !== ""));

    const citaDate = parseCitaAt(citaAt);

    const visita = new Visita({
      nombre: nombreSafe,
      documento: documentoSafe,
      empresa: empresa || null,
      empleado: empleado || null,
      motivo: motivoSafe,
      telefono: telefono || null,
      correo: correo || null,
      tipo: tipo || "Ingreso",
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
      citaAt: citaDate || null,
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
      citaAt, // fecha/hora de la cita
      llegoEnVehiculo,
      vehiculo,
    } = req.body || {};

    const nombreSafe = String(nombre || "").trim();
    const documentoSafe = String(documento || "").trim();
    const motivoSafe = String(motivo || "").trim();

    if (!nombreSafe) {
      return res.status(400).json({ ok: false, error: "nombre_required" });
    }
    if (!documentoSafe) {
      return res.status(400).json({ ok: false, error: "documento_required" });
    }
    if (!motivoSafe) {
      return res.status(400).json({ ok: false, error: "motivo_required" });
    }

    const citaDate = parseCitaAt(citaAt);
    if (!citaDate) {
      return res.status(400).json({
        ok: false,
        error: "citaAt_invalid",
        message: "La fecha/hora de la cita no es válida",
      });
    }

    const hasVehiculo =
      vehiculo &&
      ((vehiculo.placa && String(vehiculo.placa).trim() !== "") ||
        (vehiculo.marca && String(vehiculo.marca).trim() !== "") ||
        (vehiculo.modelo && String(vehiculo.modelo).trim() !== ""));

    const visita = new Visita({
      nombre: nombreSafe,
      documento: documentoSafe,
      empresa: empresa || null,
      empleado: empleado || null,
      motivo: motivoSafe,
      telefono: telefono || null,
      correo: correo || null,
      tipo: "Agendada",
      citaAt: citaDate,
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
 *  - ?estado=...
 */
export async function listCitas(req, res) {
  try {
    const { day, month, estado } = req.query || {};

    const match = { tipo: "Agendada" };

    if (day) {
      const range = parseLocalDayRange(day);
      if (!range) {
        return res.status(400).json({
          ok: false,
          error: "day_invalid",
          message: "El parámetro day debe venir en formato YYYY-MM-DD",
        });
      }
      match.citaAt = { $gte: range.start, $lt: range.end };
    } else if (month) {
      const range = parseLocalMonthRange(month);
      if (!range) {
        return res.status(400).json({
          ok: false,
          error: "month_invalid",
          message: "El parámetro month debe venir en formato YYYY-MM",
        });
      }
      match.citaAt = { $gte: range.start, $lt: range.end };
    }

    if (estado) {
      match.estado = normalizeEstado(estado);
    }

    const citas = await Visita.find(match)
      .sort({ citaAt: 1, createdAt: -1 })
      .lean();

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
 * PATCH /api/citas/:id/estado
 * Actualiza el estado de la cita (en_revision, autorizada, denegada, cancelada, etc.)
 * para que se refleje también en la Agenda de Citas.
 */
export async function updateCitaEstado(req, res) {
  try {
    const { id } = req.params;
    const estadoNormalizado = normalizeEstado(req.body?.estado);

    if (!estadoNormalizado) {
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

    visita.estado = estadoNormalizado;
    await visita.save();

    return res.json({ ok: true, item: visita });
  } catch (err) {
    console.error("[visitas] updateCitaEstado", err);

    if (err?.name === "ValidationError") {
      return res.status(400).json({ ok: false, error: err.message });
    }

    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * GET /api/visitas/vehiculos-en-sitio
 * Vehículos de VISITANTES actualmente dentro de la empresa, incluyendo
 * tanto visitas reales (estado "Dentro") como citas programadas (tipo "Agendada")
 * que tengan vehículo. Esto permite al módulo de Control de Acceso
 * mostrar en una sola tabla los vehículos de visitantes en el estacionamiento.
 */
export async function listVehiculosVisitasEnSitio(req, res) {
  try {
    // Visitas que ya están dentro de la empresa
    const visitasDentro = await Visita.find({
      estado: "Dentro",
      llegoEnVehiculo: true,
      $or: [
        { "vehiculo.placa": { $exists: true, $ne: "" } },
        { placa: { $exists: true, $ne: "" } },
      ],
    })
      .sort({ fechaEntrada: -1, createdAt: -1 })
      .lean();

    // Citas agendadas con vehículo que aún no se han cerrado
    const citasConVehiculo = await Visita.find({
      tipo: "Agendada",
      estado: {
        $in: [
          "Programada",
          "en_revision",
          "autorizada",
          // compatibilidad legacy por si existe data vieja
          "En revisión",
          "Autorizada",
        ],
      },
      llegoEnVehiculo: true,
      $or: [
        { "vehiculo.placa": { $exists: true, $ne: "" } },
        { placa: { $exists: true, $ne: "" } },
      ],
    })
      .sort({ citaAt: 1, createdAt: -1 })
      .lean();

    // Transformamos ambas listas al mismo formato esperado por el frontend
    const items = [
      ...visitasDentro.map((v) => {
        const veh = v.vehiculo;
        const marca = typeof veh === "string" ? veh : veh?.marca || "";
        const modelo = typeof veh === "string" ? "" : veh?.modelo || "";
        const placa =
          (veh && typeof veh === "object" && veh.placa) || v.placa || "";

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
      }),
      ...citasConVehiculo.map((v) => {
        const veh = v.vehiculo;
        const marca = typeof veh === "string" ? veh : veh?.marca || "";
        const modelo = typeof veh === "string" ? "" : veh?.modelo || "";
        const placa =
          (veh && typeof veh === "object" && veh.placa) || v.placa || "";

        return {
          id: v._id.toString(),
          visitante: v.nombre,
          documento: v.documento,
          empresa: v.empresa,
          empleadoAnfitrion: v.empleado,
          vehiculoMarca: marca,
          vehiculoModelo: modelo,
          placa,
          horaEntrada: v.citaAt,
        };
      }),
    ];

    res.json({ ok: true, items });
  } catch (err) {
    console.error("[visitas] listVehiculosVisitasEnSitio", err);
    res.status(500).json({
      ok: false,
      error: err.message || "Error al obtener vehículos de visitas en sitio",
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
  updateCitaEstado,
  listVehiculosVisitasEnSitio,
};