import { Router } from "express";
import {
  listDocsController,
  getDocController,
} from "../controllers/support.controller.js";

const router = Router();

/* Lista todos los manuales */
router.get("/docs", listDocsController);

/* Obtener manual específico */
router.get("/docs/:slug", getDocController);

export default router;