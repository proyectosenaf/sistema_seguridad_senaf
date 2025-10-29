import Visita from "./visitas.model.js";

/**
 * GET /api/visitas
 * Lista todas las visitas (podemos luego filtrar por fecha si queremos)
 */
export async function getVisitas(req, res) {
  try {
    const visitas = await Visita.find().sort({ createdAt: -1 });
    res.json({ ok: true, items: visitas });
  } catch (err) {
    console.error("[visitas] getVisitas error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * POST /api/visitas
 * Crea/Registra un visitante que está entrando
 */
export async function createVisita(req, res) {
  try {
    const visita = new Visita({
      nombre: req.body.nombre,
      documento: req.body.documento,
      empresa: req.body.empresa,
      empleado: req.body.empleado,
      motivo: req.body.motivo,
      telefono: req.body.telefono,
      correo: req.body.correo,
      // fechaEntrada se setea por default
    });

    await visita.save();
    res.status(201).json({ ok: true, item: visita });
  } catch (err) {
    console.error("[visitas] createVisita error:", err);
    res.status(400).json({ ok: false, error: err.message });
  }
}

/**
 * PATCH /api/visitas/:id/cerrar
 * Marca salida de un visitante
 */
export async function closeVisita(req, res) {
  try {
    const { id } = req.params;

    const visita = await Visita.findByIdAndUpdate(
      id,
      {
        estado: "Finalizada",
        fechaSalida: new Date(),
      },
      { new: true }
    );

    if (!visita) {
      return res
        .status(404)
        .json({ ok: false, error: "Visita no encontrada" });
    }

    res.json({ ok: true, item: visita });
  } catch (err) {
    console.error("[visitas] closeVisita error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
