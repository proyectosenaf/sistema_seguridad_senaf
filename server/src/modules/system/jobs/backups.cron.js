import cron from "node-cron";
import { createBackup, cleanupOldBackups } from "../services/backups.service.js";

export function startBackupsCron() {
  const expression = process.env.BACKUP_CRON || "0 2 * * 0";

  cron.schedule(expression, async () => {
    try {
      const result = await createBackup();
      console.log("[backups.cron] Backup automático creado:", result.name);

      const removed = cleanupOldBackups();
      if (removed.length) {
        console.log("[backups.cron] Backups antiguos eliminados:", removed);
      }
    } catch (error) {
      console.error("[backups.cron] Error:", error.message);
    }
  });
}