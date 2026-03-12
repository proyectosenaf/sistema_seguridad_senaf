import { Router } from "express";
import {
  getAccesoSexos,
  getAccesoEstados,
  getAccesoDepartamentos,
  getAccesoCargos,
  getVehiculoMarcas,
  getVehiculoModelos,
  getVisitasTipos,
  getCitasTipos,
  getCitasEstados,
  getAllCatalogos,
} from "../controllers/catalogos.controller.js";

const router = Router();

/* ========= ACCESO ========= */
router.get("/acceso/sexos", getAccesoSexos);
router.get("/acceso/estados", getAccesoEstados);
router.get("/acceso/departamentos", getAccesoDepartamentos);
router.get("/acceso/cargos", getAccesoCargos);

/* ========= VEHÍCULOS ========= */
router.get("/vehiculos/marcas", getVehiculoMarcas);
router.get("/vehiculos/modelos", getVehiculoModelos);

/* ========= VISITAS ========= */
router.get("/visitas/tipos", getVisitasTipos);

/* ========= CITAS ========= */
router.get("/citas/tipos", getCitasTipos);
router.get("/citas/estados", getCitasEstados);

/* ========= TODO EN UNO ========= */
router.get("/all", getAllCatalogos);

export default router;