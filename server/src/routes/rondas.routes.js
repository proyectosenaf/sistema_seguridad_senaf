import { Router } from "express";
import { RondasController } from "../controllers/rondas.controller.js";
import {
  startShiftValidator,
  finishShiftValidator,
  checkValidator
} from "../validators/rondas.validators.js";

const router = Router();

router.get("/routes",      RondasController.listRoutes);
router.get("/shifts/active", RondasController.activeShifts);

router.post("/shifts/start",  startShiftValidator,  RondasController.startShift);
router.post("/shifts/:id/finish", finishShiftValidator, RondasController.finishShift);

router.post("/check", checkValidator, RondasController.check);

export default router;
