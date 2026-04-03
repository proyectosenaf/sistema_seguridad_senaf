import { Router } from "express";
import {
  createBackupHandler,
  listBackupsHandler,
  restoreBackupHandler,
  deleteBackupHandler,
  downloadBackupHandler,
} from "../controllers/backups.controller.js";

import { requirePerm } from "../../../middleware/permissions.js";

const router = Router();

router.get("/", requirePerm("system.backups.read"), listBackupsHandler);
router.post("/create", requirePerm("system.backups.create"), createBackupHandler);
router.post("/restore", requirePerm("system.backups.restore"), restoreBackupHandler);
router.get("/download/:name", requirePerm("system.backups.download"), downloadBackupHandler);
router.delete("/:name", requirePerm("system.backups.delete"), deleteBackupHandler);

export default router;