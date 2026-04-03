import React, { useCallback, useEffect, useMemo, useState } from "react";
import { systemApi } from "../api/systemApi.js";
import BackupStatsCards from "../components/BackupStatsCards.jsx";
import BackupActionsBar from "../components/BackupActionsBar.jsx";
import BackupsTable from "../components/BackupsTable.jsx";
import RestoreBackupModal from "../components/RestoreBackupModal.jsx";

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("senaf_user") || "null");
  } catch {
    return null;
  }
}

function normalizePerms(user) {
  const perms =
    user?.perms ||
    user?.permissions ||
    user?.user?.perms ||
    user?.user?.permissions ||
    [];

  return Array.isArray(perms) ? perms : [];
}

export default function BackupRestorePage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [backups, setBackups] = useState([]);
  const [error, setError] = useState("");
  const [restoreTarget, setRestoreTarget] = useState("");

  const currentUser = useMemo(() => readStoredUser(), []);
  const perms = useMemo(() => normalizePerms(currentUser), [currentUser]);

  const canCreate =
    perms.includes("*") || perms.includes("system.backups.create");

  const canRestore =
    perms.includes("*") || perms.includes("system.backups.restore");

  const canDelete =
    perms.includes("*") || perms.includes("system.backups.delete");

  const loadBackups = useCallback(async () => {
    try {
      setError("");
      setLoading(true);
      const res = await systemApi.listBackups();
      setBackups(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      setError(
        err?.response?.data?.message || "No se pudieron cargar los respaldos."
      );
      console.error("[BackupRestorePage] loadBackups error:", err?.response?.data || err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCreateBackup = useCallback(async () => {
    if (!canCreate) return;

    try {
      setBusy(true);
      setError("");
      await systemApi.createBackup();
      await loadBackups();
      window.alert("Respaldo generado correctamente.");
    } catch (err) {
      setError(
        err?.response?.data?.message || "No se pudo generar el respaldo."
      );
    } finally {
      setBusy(false);
    }
  }, [canCreate, loadBackups]);

  const handleDownloadBackup = useCallback(async (name) => {
    try {
      setBusy(true);
      setError("");

      const blob = await systemApi.downloadBackup(name);
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err?.response?.data?.message || "No se pudo descargar el respaldo."
      );
    } finally {
      setBusy(false);
    }
  }, []);

  const handleDeleteBackup = useCallback(
    async (name) => {
      const ok = window.confirm(`¿Eliminar el respaldo "${name}"?`);
      if (!ok) return;

      try {
        setBusy(true);
        setError("");
        await systemApi.deleteBackup(name);
        await loadBackups();
      } catch (err) {
        setError(
          err?.response?.data?.message || "No se pudo eliminar el respaldo."
        );
      } finally {
        setBusy(false);
      }
    },
    [loadBackups]
  );

  const handleConfirmRestore = useCallback(async () => {
    if (!restoreTarget) return;

    try {
      setBusy(true);
      setError("");
      await systemApi.restoreBackup(restoreTarget);
      setRestoreTarget("");
      window.alert("Respaldo restaurado correctamente.");
    } catch (err) {
      setError(
        err?.response?.data?.message || "No se pudo restaurar el respaldo."
      );
    } finally {
      setBusy(false);
    }
  }, [restoreTarget]);

  useEffect(() => {
    loadBackups();
  }, [loadBackups]);

  return (
    <section className="space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold">Respaldo y Restauración</h1>
        <p className="mt-1 text-sm opacity-70">
          Administra respaldos completos del sistema SENAF.
        </p>
      </header>

      <BackupStatsCards backups={backups} />

      {canCreate ? (
        <BackupActionsBar
          busy={busy}
          onRefresh={loadBackups}
          onCreateBackup={handleCreateBackup}
        />
      ) : (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={loadBackups}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2"
            style={{ borderColor: "var(--border)" }}
          >
            Actualizar
          </button>
        </div>
      )}

      {error ? (
        <div
          className="rounded-xl border px-4 py-3 text-sm text-red-500"
          style={{ borderColor: "var(--border)" }}
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <div
          className="rounded-xl border px-4 py-6 text-sm"
          style={{ borderColor: "var(--border)" }}
        >
          Cargando respaldos...
        </div>
      ) : (
        <BackupsTable
          backups={backups}
          canRestore={canRestore}
          canDelete={canDelete}
          onDownload={handleDownloadBackup}
          onRestore={setRestoreTarget}
          onDelete={handleDeleteBackup}
        />
      )}

      <RestoreBackupModal
        open={!!restoreTarget}
        backupName={restoreTarget}
        busy={busy}
        onClose={() => setRestoreTarget("")}
        onConfirm={handleConfirmRestore}
      />
    </section>
  );
}