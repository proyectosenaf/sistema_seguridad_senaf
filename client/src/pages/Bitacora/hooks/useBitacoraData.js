import { useCallback, useEffect, useState } from "react";
import {
  deleteBitacoraEvent,
  fetchBitacoraEventDetail,
  fetchBitacoraEvents,
} from "../services/bitacora.service.js";

const REFRESH_MS = 15000;

export function useBitacoraData() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);

  const loadAll = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);

    try {
      const backendRows = await fetchBitacoraEvents();
      setRows(Array.isArray(backendRows) ? backendRows : []);
      setLoadError("");
    } catch (err) {
      console.error("[bitacora] loadAll:", err);
      setLoadError("No se pudo cargar la bitácora en tiempo real.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const fetchDetail = useCallback(async (rowId) => {
    const safeId = String(rowId || "").trim();
    if (!safeId) {
      throw new Error("No se recibió un identificador válido para el detalle.");
    }

    setDetailLoading(true);

    try {
      const detail = await fetchBitacoraEventDetail(safeId);
      return detail;
    } catch (err) {
      console.error("[bitacora] fetchDetail:", err);
      throw err;
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const removeRow = useCallback(
    async (row) => {
      if (!row) return { ok: false };

      const rowId = String(row._id || row.id || "");
      if (!rowId) {
        throw new Error("El registro no tiene identificador válido.");
      }

      const previousRows = rows;

      setDeletingId(rowId);
      setRows((prev) => prev.filter((r) => String(r._id || r.id) !== rowId));

      try {
        await deleteBitacoraEvent(rowId);
        return { ok: true };
      } catch (err) {
        console.error("[bitacora] error archivando evento:", err);
        setRows(previousRows);
        throw err;
      } finally {
        setDeletingId("");
      }
    },
    [rows]
  );

  useEffect(() => {
    loadAll();

    const intervalId = window.setInterval(() => {
      loadAll({ silent: true });
    }, REFRESH_MS);

    const onFocus = () => loadAll({ silent: true });

    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
    };
  }, [loadAll]);

  return {
    rows,
    loading,
    loadError,
    deletingId,
    detailLoading,
    reload: loadAll,
    setRows,
    removeRow,
    fetchDetail,
  };
}