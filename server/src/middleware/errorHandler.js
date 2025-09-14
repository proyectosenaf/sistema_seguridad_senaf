import { isCelebrateError } from 'celebrate';

export const notFound = (req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada' });
};

export const errorHandler = (err, req, res, next) => {
  console.error('[error]', err);
  if (isCelebrateError(err)) {
    const details = {};
    for (const [segment, joiError] of err.details.entries()) {
      details[segment] = joiError.details.map((d) => d.message);
    }
    return res.status(400).json({ message: 'Validación fallida', details });
  }
  res.status(err.status || 500).json({ message: err.message || 'Error interno' });
};