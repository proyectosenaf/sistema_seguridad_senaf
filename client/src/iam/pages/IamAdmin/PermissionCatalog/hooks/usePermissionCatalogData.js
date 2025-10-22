import { useEffect, useMemo, useState } from "react";
import { iamApi } from "../../../../api/iamApi";
import { normalizeAndMergeGroups, MODULES, emptyFlagsForRoles, coerceFlagsByRoleIds } from "../utils/catalogUtils";

export function usePermissionCatalogData() {
  const [loading, setLoading]   = useState(true);
  const [errorMsg, setError]    = useState("");
  const [banner, setBanner]     = useState(null);

  const [roles, setRoles]       = useState([]);
  const [groups, setGroups]     = useState([]);

  // roleMatrix: { [permKey]: { [roleId]: boolean } }
  const [roleMatrix, setRoleMatrix] = useState({});
  const [origMatrix, setOrigMatrix] = useState({});

  const [query, setQuery] = useState("");
  const [compactView, setCompactView] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Roles
        const rRoles = await iamApi.listRoles();
        const roleItems = (rRoles?.items || []).slice().sort((a,b) => String(a.name||a.code).localeCompare(String(b.name||b.code)));
        setRoles(roleItems);

        // Catálogo
        const rPerms = await iamApi.listPerms(); // { items, groups }
        const normalized = normalizeAndMergeGroups(rPerms?.groups || []);
        setGroups(normalized);

        // Base matrix
        const base = {};
        for (const g of normalized) for (const it of g.items) base[it.key] = emptyFlagsForRoles(roleItems);

        // Rellenar por rol
        const filled = { ...base };
        for (const role of roleItems) {
          const r = await iamApi.getRolePerms(role._id); // { permissionKeys: string[] }
          const setKeys = new Set(r?.permissionKeys || []);
          for (const k of Object.keys(filled)) if (setKeys.has(k)) filled[k][role._id] = true;
        }

        setRoleMatrix(filled);
        setOrigMatrix(JSON.parse(JSON.stringify(filled)));
        setError("");
      } catch (e) {
        setError(e?.message || "No se pudo cargar el catálogo de permisos.");
        setGroups([]); setRoleMatrix({}); setOrigMatrix({});
      } finally { setLoading(false); }
    })();
  }, []);

  const onToggle = (permKey, roleId) => {
    setRoleMatrix(prev => {
      const curr = coerceFlagsByRoleIds(prev[permKey], roles);
      return { ...prev, [permKey]: { ...curr, [roleId]: !curr[roleId] } };
    });
  };

  const onSaveAll = async () => {
    // descubro roles que cambiaron
    const changedIds = new Set();
    for (const k of Object.keys(roleMatrix)) {
      const a = roleMatrix[k] || {};
      const b = origMatrix[k] || {};
      for (const r of roles) if (Boolean(a[r._id]) !== Boolean(b[r._id])) changedIds.add(r._id);
    }
    if (changedIds.size === 0) {
      setBanner({ type: "warn", msg: "No hay cambios para guardar." });
      setTimeout(() => setBanner(null), 3000);
      return;
    }
    try {
      for (const roleId of changedIds) {
        const keys = [];
        for (const [permKey, flags] of Object.entries(roleMatrix)) if (flags?.[roleId]) keys.push(permKey);
        await iamApi.setRolePerms(roleId, keys);
      }
      setOrigMatrix(JSON.parse(JSON.stringify(roleMatrix)));
      setBanner({ type: "ok", msg: `Cambios guardados en ${changedIds.size} rol(es).` });
      setTimeout(() => setBanner(null), 3000);
    } catch (e) {
      setBanner({ type: "err", msg: e?.message || "No se pudieron guardar los cambios." });
      setTimeout(() => setBanner(null), 3500);
    }
  };

  const onCreatePerm = async ({ key, label, moduleValue }) => {
    const k = String(key||"").trim();
    const l = String(label||"").trim();
    const m = MODULES.find(x => x.value === moduleValue) || MODULES[0];
    const group = m.label;
    if (!k || !l) {
      setBanner({ type: "warn", msg: "Completa clave y etiqueta." });
      setTimeout(() => setBanner(null), 2500);
      return false;
    }
    try {
      const created = await iamApi.createPerm({ key:k, label:l, group });
      // agrega al estado actual
      const nextGroups = (() => {
        const out = groups.map(g => ({ ...g, items: [...g.items] }));
        let gi = out.findIndex(g => g.group === group);
        if (gi === -1) { out.push({ group, items: [] }); gi = out.length - 1; }
        out[gi].items.push({ ...(created||{ key:k, label:l, group }), key:k, label:l, group });
        out[gi].items.sort((a,b)=>String(a.label).localeCompare(String(b.label)));
        out.sort((a,b)=>String(a.group).localeCompare(String(b.group)));
        return out;
      })();
      setGroups(nextGroups);
      setRoleMatrix(prev => ({ ...prev, [k]: emptyFlagsForRoles(roles) }));
      setOrigMatrix(prev => ({ ...prev, [k]: emptyFlagsForRoles(roles) }));
      setBanner({ type: "ok", msg: "Permiso creado." });
      setTimeout(() => setBanner(null), 2500);
      return true;
    } catch (e) {
      setBanner({ type: "err", msg: e?.message || "No se pudo crear el permiso." });
      setTimeout(() => setBanner(null), 3500);
      return false;
    }
  };

  const onDeletePerm = async ({ id, key }) => {
    try {
      if (id) await iamApi.deletePerm(id);
      const nextGroups = groups.map(g => ({ ...g, items: g.items.filter(it => it.key !== key) }))
                               .filter(g => g.items.length > 0);
      setGroups(nextGroups);
      const { [key]: _, ...nextM } = roleMatrix;
      const { [key]: __, ...nextO } = origMatrix;
      setRoleMatrix(nextM); setOrigMatrix(nextO);
      setBanner({ type: "ok", msg: "Permiso eliminado." });
      setTimeout(() => setBanner(null), 2500);
    } catch (e) {
      setBanner({ type: "err", msg: e?.message || "No se pudo eliminar el permiso." });
      setTimeout(() => setBanner(null), 3500);
    }
  };

  return {
    // estado
    loading, errorMsg, banner, setBanner,
    roles, groups, roleMatrix, origMatrix,
    query, setQuery, compactView, setCompactView,
    // acciones
    onToggle, onSaveAll, onCreatePerm, onDeletePerm,
  };
}
