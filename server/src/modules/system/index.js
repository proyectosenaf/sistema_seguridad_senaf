import backupsRoutes from "./routes/backups.routes.js";
import { startBackupsCron } from "./jobs/backups.cron.js";

export function registerSystemModule(app) {
  app.use("/api/system/backups", backupsRoutes);
}

export function bootSystemModule() {
  startBackupsCron();
}