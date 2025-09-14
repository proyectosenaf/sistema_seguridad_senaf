// server/src/middleware/validate.js
import { validationResult } from "express-validator";

export function validate(rules = []) {
  return [
    ...(Array.isArray(rules) ? rules : [rules]),
    (req, res, next) => {
      const result = validationResult(req);
      if (!result.isEmpty()) {
        return res.status(400).json({
          error: "validation_error",
          details: result.array(),
        });
      }
      next();
    },
  ];
}

// Middleware para validar requests usando express-validator.
// Úsalo así: router.post("/", validate(rules), (req, res) => { ... });
// O con múltiples middlewares: router.post("/", validate([...rules1, ...rules2]), (req, res) => { ... });