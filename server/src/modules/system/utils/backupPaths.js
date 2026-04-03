import fs from "fs";
import path from "path";

export function getBackupBaseDir() {
  const dir = process.env.BACKUP_DIR
    ? path.resolve(process.env.BACKUP_DIR)
    : path.resolve(process.cwd(), "backups");

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return dir;
}

export function buildBackupName(prefix = "senaf-backup") {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");

  return `${prefix}-${yyyy}${mm}${dd}-${hh}${mi}${ss}.gz`;
}