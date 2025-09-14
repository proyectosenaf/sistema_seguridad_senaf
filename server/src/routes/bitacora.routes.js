import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { idParam } from "../validators/common.js";
import { createBitacora, updateBitacora } from "../validators/bitacora.js";
import * as ctrl from "../controllers/bitacora.controller.js";

const r = Router();
r.use(requireAuth);

r.get("/", ctrl.list);
r.post("/", createBitacora, validate(), ctrl.create);
r.get("/:id", idParam, validate(), ctrl.getById);
r.patch("/:id", idParam, updateBitacora, validate(), ctrl.update);
r.delete("/:id", idParam, validate(), ctrl.remove);

export default r;
