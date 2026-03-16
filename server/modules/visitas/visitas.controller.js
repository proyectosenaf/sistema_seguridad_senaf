import crypto from "crypto";
import QRCode from "qrcode";
import Visita from "./visitas.model.js";

const QR_PREFIX = "SENAF_CITA_QR::";

function hasVehicleData(vehiculo) {
  if (!vehiculo || typeof vehiculo !== "object") return false;

  return !!(
    (vehiculo.placa && String(vehiculo.placa).trim() !== "") ||
    (vehiculo.marca && String(vehiculo.marca).trim() !== "") ||
    (vehiculo.modelo && String(vehiculo.modelo).trim() !== "")
  );
}

function normalizeVehiculoInput(vehiculo) {
  if (!hasVehicleData(vehiculo)) return null;

  return {
    marca: String(vehiculo?.marca || "").trim(),
    modelo: String(vehiculo?.modelo || "").trim(),
    placa: String(vehiculo?.placa || "").trim().toUpperCase(),
  };
}

function buildDayRange(day) {
  const d = new Date(day);
  if (Number.isNaN(d.getTime())) return null;

  const start = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    0,
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
    0,
    0
  );

  return { start, end };
}

function buildMonthRange(month) {
  if (!month || typeof month !== "string") return null;

  const parts = month.split("-");
  if (parts.length !== 2) return null;

  const yyyy = parseInt(parts[0], 10);
  const mm = parseInt(parts[1], 10);

  if (Number.isNaN(yyyy) || Number.isNaN(mm) || mm < 1 || mm > 12) {
    return null;
  }

  const start = new Date(yyyy, mm - 1, 1, 0, 0, 0, 0);
  const end = new Date(yyyy, mm, 1, 0, 0, 0, 0);

  return { start, end };
}

function getActorId(req) {
  return req?.user?._id || req?.user?.id || null;
}

function normalizeEstadoInput(estado) {
  const raw = String(estado || "").trim().toLowerCase();

  const map = {
    solicitada: "Programada",
    programada: "Programada",
    "en revisión": "En revisión",
    en_revision: "En revisión",
    autorizada: "Autorizada",
    denegada: "Denegada",
    cancelada: "Cancelada",
    dentro: "Dentro",
    finalizada: "Finalizada",
  };

  return map[raw] || estado;
}

function canEnterByEstado(estado) {
  return ["Programada", "En revisión", "Autorizada"].includes(estado);
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

    return res.json({ ok: true, items: visitas });
  } catch (err) {
    console.error("[visitas] getVisitas", err);
    return res.status(500).json({ ok: false, error: err.message });
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
      tipo, // compatibilidad
      llegoEnVehiculo,
      vehiculo,
      citaAt,
    } = req.body || {};

    const normalizedVehiculo = normalizeVehiculoInput(vehiculo);
    const hasVehiculo = !!normalizedVehiculo;

    const visita = new Visita({
      nombre,
      documento,
      empresa: empresa || null,
      empleado: empleado || null,
      motivo,
      telefono: telefono || null,
      correo: correo || null,
      tipo: tipo || "Ingreso",
      llegoEnVehiculo:
        typeof llegoEnVehiculo !== "undefined"
          ? !!llegoEnVehiculo
          : hasVehiculo,
      vehiculo:
        typeof llegoEnVehiculo !== "undefined"
          ? !!llegoEnVehiculo
            ? normalizedVehiculo
            : null
          : normalizedVehiculo,
      citaAt: citaAt || null,
    });

    await visita.save();

    return res.status(201).json({
      ok: true,
      item: visita,
    });
  } catch (err) {
    console.error("[visitas] createVisita", err);
    return res.status(400).json({ ok: false, error: err.message });
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
      return res.status(404).json({
        ok: false,
        error: "Visita no encontrada",
      });
    }

    if (!visita.fechaSalida) {
      visita.fechaSalida = new Date();
    }

    visita.estado = "Finalizada";

    await visita.save();

    return res.json({ ok: true, item: visita });
  } catch (err) {
    console.error("[visitas] closeVisita", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * POST /api/citas
 * Crear una cita agendada futura
 * Genera:
 * - qrToken
 * - qrPayload
 * - qrDataUrl
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
      citaAt,
      llegoEnVehiculo,
      vehiculo,
    } = req.body || {};

    const normalizedVehiculo = normalizeVehiculoInput(vehiculo);
    const hasVehiculo = !!normalizedVehiculo;

    const citaDate = citaAt ? new Date(citaAt) : null;
    if (!citaDate || Number.isNaN(citaDate.getTime())) {
      return res.status(400).json({
        ok: false,
        error: "Debe indicar una fecha/hora de cita válida",
      });
    }

    const qrToken = crypto.randomUUID();
    const qrPayload = `${QR_PREFIX}${qrToken}`;

    const visita = new Visita({
      nombre,
      documento,
      empresa: empresa || null,
      empleado: empleado || null,
      motivo,
      telefono: telefono || null,
      correo: correo || null,
      tipo: "Agendada",
      estado: "Programada",
      citaAt: citaDate,
      llegoEnVehiculo:
        typeof llegoEnVehiculo !== "undefined"
          ? !!llegoEnVehiculo
          : hasVehiculo,
      vehiculo:
        typeof llegoEnVehiculo !== "undefined"
          ? !!llegoEnVehiculo
            ? normalizedVehiculo
            : null
          : normalizedVehiculo,
      qrToken,
      qrPayload,
    });

    await visita.save();

    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      width: 320,
      margin: 1,
      errorCorrectionLevel: "M",
    });

    const item = visita.toObject ? visita.toObject() : visita;
    item.qrDataUrl = qrDataUrl;
    item.qrPayload = qrPayload;
    item.qrToken = qrToken;

    return res.status(201).json({
      ok: true,
      item,
      qrDataUrl,
      qrPayload,
      qrToken,
    });
  } catch (err) {
    console.error("[visitas] createCita", err);
    return res.status(400).json({ ok: false, error: err.message });
  }
}

/**
 * GET /api/citas
 * Listar citas programadas
 * Soporta:
 *  - ?day=YYYY-MM-DD
 *  - ?month=YYYY-MM
 *  - ?estado=Programada
 *  - ?q=texto
 */
export async function listCitas(req, res) {
  try {
    const { day, month, estado, q } = req.query || {};

    const match = { tipo: "Agendada" };

    if (day) {
      const range = buildDayRange(day);
      if (!range) {
        return res.status(400).json({
          ok: false,
          error: "Parámetro day inválido. Use YYYY-MM-DD",
        });
      }
      match.citaAt = { $gte: range.start, $lt: range.end };
    } else if (month) {
      const range = buildMonthRange(month);
      if (!range) {
        return res.status(400).json({
          ok: false,
          error: "Parámetro month inválido. Use YYYY-MM",
        });
      }
      match.citaAt = { $gte: range.start, $lt: range.end };
    }

    if (estado) {
      match.estado = normalizeEstadoInput(estado);
    }

    if (q && String(q).trim() !== "") {
      const rx = new RegExp(String(q).trim(), "i");
      match.$or = [
        { nombre: rx },
        { documento: rx },
        { empresa: rx },
        { empleado: rx },
        { motivo: rx },
      ];
    }

    const citas = await Visita.find(match)
      .sort({ citaAt: 1, createdAt: -1 })
      .lean();

    return res.json({ ok: true, items: citas });
  } catch (err) {
    console.error("[visitas] listCitas", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * PATCH /api/citas/:id/checkin
 * Registrar check-in de una cita
 */
export async function checkinCita(req, res) {
  try {
    const { id } = req.params;

    const visita = await Visita.findById(id);
    if (!visita) {
      return res.status(404).json({
        ok: false,
        error: "Cita/visita no encontrada",
      });
    }

    if (visita.tipo !== "Agendada") {
      return res.status(400).json({
        ok: false,
        error: "El registro indicado no corresponde a una cita agendada",
      });
    }

    const estadoActual = normalizeEstadoInput(visita.estado);

    if (estadoActual === "Dentro") {
      return res.json({
        ok: true,
        item: visita,
        message: "La cita ya estaba registrada como dentro",
      });
    }

    if (estadoActual === "Finalizada") {
      return res.status(409).json({
        ok: false,
        error: "La visita ya fue finalizada",
      });
    }

    if (estadoActual === "Cancelada" || estadoActual === "Denegada") {
      return res.status(409).json({
        ok: false,
        error: `No se puede registrar ingreso porque la cita está en estado "${estadoActual}"`,
      });
    }

    if (!canEnterByEstado(estadoActual)) {
      return res.status(409).json({
        ok: false,
        error: `La cita no puede ingresar desde el estado "${estadoActual}"`,
      });
    }

    const actorId = getActorId(req);
    const now = new Date();

    visita.estado = "Dentro";

    if (!visita.fechaEntrada) {
      visita.fechaEntrada = now;
    }

    if (!visita.validatedAt) {
      visita.validatedAt = now;
    }

    if (!visita.ingresadaAt) {
      visita.ingresadaAt = now;
    }

    if (actorId && !visita.validatedBy) {
      visita.validatedBy = actorId;
    }

    if (actorId && !visita.ingresadaBy) {
      visita.ingresadaBy = actorId;
    }

    await visita.save();

    return res.json({ ok: true, item: visita });
  } catch (err) {
    console.error("[visitas] checkinCita", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * PATCH /api/citas/:id/estado
 * Actualiza el estado de la cita
 */
export async function updateCitaEstado(req, res) {
  try {
    const { id } = req.params;
    const { estado } = req.body || {};

    if (!estado) {
      return res.status(400).json({
        ok: false,
        error: "Debe indicar un estado",
      });
    }

    const visita = await Visita.findById(id);
    if (!visita) {
      return res.status(404).json({
        ok: false,
        error: "Cita/visita no encontrada",
      });
    }

    const nextEstado = normalizeEstadoInput(estado);
    visita.estado = nextEstado;

    if (nextEstado === "Dentro" && !visita.fechaEntrada) {
      visita.fechaEntrada = new Date();
    }

    await visita.save();

    return res.json({ ok: true, item: visita });
  } catch (err) {
    console.error("[visitas] updateCitaEstado", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * POST /api/citas/scan-qr
 * Escanea QR y registra ingreso inmediato
 */
export async function scanQrCita(req, res) {
  try {
    const { qrText, qrPayload } = req.body || {};
    const raw = qrText || qrPayload;

    if (!raw || typeof raw !== "string") {
      return res.status(400).json({
        ok: false,
        error: "Debe enviar qrText o qrPayload",
      });
    }

    if (!raw.startsWith(QR_PREFIX)) {
      return res.status(400).json({
        ok: false,
        error: "Formato de QR no válido",
      });
    }

    const qrToken = raw.slice(QR_PREFIX.length).trim();
    if (!qrToken) {
      return res.status(400).json({
        ok: false,
        error: "QR inválido",
      });
    }

    const visita = await Visita.findOne({ qrToken });
    if (!visita) {
      return res.status(404).json({
        ok: false,
        error: "No se encontró una cita asociada a este QR",
      });
    }

    if (visita.tipo !== "Agendada") {
      return res.status(409).json({
        ok: false,
        error: "El QR pertenece a un registro que no es una cita agendada",
        item: visita,
      });
    }

    const estadoActual = normalizeEstadoInput(visita.estado);

    if (estadoActual === "Finalizada") {
      return res.status(409).json({
        ok: false,
        error: "La visita ya fue finalizada",
        item: visita,
      });
    }

    if (estadoActual === "Cancelada" || estadoActual === "Denegada") {
      return res.status(409).json({
        ok: false,
        error: `La cita no puede ingresar porque está en estado "${estadoActual}"`,
        item: visita,
      });
    }

    if (estadoActual === "Dentro") {
      return res.status(409).json({
        ok: false,
        error: "La cita ya fue registrada previamente como dentro",
        item: visita,
      });
    }

    if (!canEnterByEstado(estadoActual)) {
      return res.status(409).json({
        ok: false,
        error: `La cita no puede ingresar desde el estado "${estadoActual}"`,
        item: visita,
      });
    }

    const actorId = getActorId(req);
    const now = new Date();

    visita.estado = "Dentro";
    visita.validatedAt = now;

    if (actorId) {
      visita.validatedBy = actorId;
    }

    if (!visita.fechaEntrada) {
      visita.fechaEntrada = now;
    }

    if (!visita.ingresadaAt) {
      visita.ingresadaAt = now;
    }

    if (actorId) {
      visita.ingresadaBy = actorId;
    }

    await visita.save();

    return res.json({
      ok: true,
      item: visita,
      message: "Ingreso registrado correctamente",
    });
  } catch (err) {
    console.error("[visitas] scanQrCita", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "Error al procesar el QR",
    });
  }
}

/**
 * GET /api/visitas/vehiculos-en-sitio
 */
export async function listVehiculosVisitasEnSitio(req, res) {
  try {
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

    const citasConVehiculo = await Visita.find({
      tipo: "Agendada",
      estado: { $in: ["Programada", "En revisión", "Autorizada"] },
      llegoEnVehiculo: true,
      $or: [
        { "vehiculo.placa": { $exists: true, $ne: "" } },
        { placa: { $exists: true, $ne: "" } },
      ],
    })
      .sort({ citaAt: 1, createdAt: -1 })
      .lean();

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
          tipo: v.tipo,
          estado: v.estado,
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
          tipo: v.tipo,
          estado: v.estado,
        };
      }),
    ];

    return res.json({ ok: true, items });
  } catch (err) {
    console.error("[visitas] listVehiculosVisitasEnSitio", err);
    return res.status(500).json({
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
  scanQrCita,
  listVehiculosVisitasEnSitio,
};