// client/src/iam/pages/IamAdmin/PermissionCatalog.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { iamApi } from "../../api/iamApi";
import { normalizePermsResponse, fallbackGroupsFromLocal } from "../../lib/permUtils.js";

export default function PermissionCatalog() {
  const [groups, setGroups] = useState([]); // [{ group, items: [{_id,key,label,group,order}] }]
  const [query, setQuery] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // debounce
  const tRef = useRef(null);
  useEffect(() => {
    clearTimeout(tRef.current);
    tRef.current = setTimeout(() => setQDebounced(query.trim().toLowerCase()), 200);
    return () => clearTimeout(tRef.current);
  }, [query]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const res = await iamApi.listPerms();
        let normalized = normalizePermsResponse(res);

        // Fallback a catálogo local si no hay nada
        const total = normalized.reduce((acc, g) => acc + (g.items?.length || 0), 0);
        if (total === 0) normalized = fallbackGroupsFromLocal();

        if (alive) setGroups(normalized);
      } catch (e) {
        // Fallback total si la API falla
        if (alive) {
          setErr(e?.message || "Error al cargar permisos desde API. Se muestra catálogo local.");
          setGroups(fallbackGroupsFromLocal());
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    if (!qDebounced) return groups;
    return groups
      .map(g => ({
        ...g,
        items: g.items.filter(it =>
          String(it.key || "").toLowerCase().includes(qDebounced) ||
          String(it.label || "").toLowerCase().includes(qDebounced) ||
          String(g.group || "").toLowerCase().includes(qDebounced)
        ),
      }))
      .filter(g => g.items.length > 0);
  }, [groups, qDebounced]);

  const toggleAll = (open) => {
    document.querySelectorAll("details[data-perm-group]").forEach(d => { d.open = open; });
  };

  if (loading) return <div className="p-4 text-gray-600 dark:text-gray-300">Cargando permisos…</div>;

  return (
    <div className="space-y-4">
      {err && (
        <div className="rounded border border-amber-300 bg-amber-50 text-amber-900 p-3">
          {err}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por clave, etiqueta o módulo…"
          className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white/70 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
          aria-label="Buscar permisos"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => toggleAll(true)}
            className="px-2.5 py-1.5 text-sm rounded-md bg-gray-200 text-gray-800 hover:bg-gray-300 
                       dark:bg-neutral-800 dark:text-gray-200 dark:hover:bg-neutral-700 
                       transition-colors duration-150 shadow-sm"
            title="Expandir todos"
          >
            Expandir todo
          </button>
          <button
            type="button"
            onClick={() => toggleAll(false)}
            className="px-2.5 py-1.5 text-sm rounded-md bg-gray-200 text-gray-800 hover:bg-gray-300 
                       dark:bg-neutral-800 dark:text-gray-200 dark:hover:bg-neutral-700 
                       transition-colors duration-150 shadow-sm"
            title="Colapsar todos"
          >
            Colapsar todo
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-4 text-gray-600 dark:text-gray-300">
          No se encontraron permisos para “{query}”.
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden divide-y divide-gray-200 dark:divide-gray-700">
          {filtered.map((g, idx) => (
            <details key={`${g.group}-${idx}`} open data-perm-group className="group">
              <summary className="cursor-pointer select-none bg-gray-100 dark:bg-gray-800 px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">
                {g.group}
                <span className="ml-2 text-gray-500 dark:text-gray-400 font-normal">
                  ({g.items.length})
                </span>
              </summary>

              <div className="bg-white dark:bg-gray-900">
                {g.items.map((it) => (
                  <div
                    key={it._id || it.key}
                    className="px-4 py-2 grid grid-cols-1 md:grid-cols-2 gap-2 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <div className="font-mono text-xs md:text-sm text-gray-700 dark:text-gray-300 break-all">
                      {it.key}
                    </div>
                    <div className="text-sm text-gray-800 dark:text-gray-200">
                      {it.label}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
