// client/src/iam/tools/seedIam.js
import { permisosKeys, rolesKeys } from "../catalog/perms.js";
import { iamApi } from "../api/iamApi.js";

/**
 * Seed de IAM (permisos y roles) a partir del catálogo local:
 * - Crea permisos que falten
 * - Crea roles que falten
 * - Actualiza roles si sus permisos no coinciden con el catálogo
 *
 * Autenticación:
 * - `token` es OPCIONAL y representa un bearer token genérico.
 * - Si tu `iamApi` ya adjunta credenciales (cookies/sesión/interceptor), puedes pasar null.
 */
export async function seedPermissionsAndRoles(token = null) {
  // 1) PERMISOS
  let existingPerms = [];
  try {
    const res = await iamApi.listPerms(token);
    existingPerms = res?.items || res?.permissions || [];
  } catch (e) {
    console.warn("[seed] no se pudo listar permisos:", e?.message || e);
    existingPerms = [];
  }

  const existingSet = new Set(
    existingPerms.map((p) => p?.key || p?.name).filter(Boolean)
  );

  // Crear los que falten
  for (const [key, label] of Object.entries(permisosKeys)) {
    if (existingSet.has(key)) continue;

    const group = String(key).split(".")[0] || "general";
    const order = 0;

    try {
      await iamApi.createPerm({ key, label, group, order }, token);
      existingSet.add(key);
      console.log("[seed] permiso creado:", key);
    } catch (e) {
      console.warn("[seed] no se pudo crear permiso", key, e?.message || e);
    }
  }

  // 2) ROLES
  let existingRoles = [];
  try {
    const r = await iamApi.listRoles(token);
    existingRoles = r?.items || r?.roles || [];
  } catch (e) {
    console.warn("[seed] no se pudo listar roles:", e?.message || e);
    existingRoles = [];
  }

  // Index por code/key/name/_id
  const roleIdx = new Map();
  for (const r of existingRoles) {
    const code = r?.code || r?.key || r?.name || r?._id || "";
    if (code) roleIdx.set(code, r);
  }

  for (const [roleCode, permList] of Object.entries(rolesKeys)) {
    const desired = Array.isArray(permList) ? permList : [];
    const role = roleIdx.get(roleCode);

    if (!role) {
      // Crear rol
      try {
        await iamApi.createRole(
          {
            code: roleCode, // el backend espera `code`
            name: roleCode,
            description: roleCode,
            permissions: desired,
          },
          token
        );
        console.log("[seed] rol creado:", roleCode);
      } catch (e) {
        console.warn("[seed] no se pudo crear rol", roleCode, e?.message || e);
      }
      continue;
    }

    // Comparar permisos actuales vs deseados
    const currentRaw = role.permissionKeys || role.permissions || role.perms;
    const current = Array.isArray(currentRaw) ? currentRaw : [];

    const same =
      current.length === desired.length &&
      current.every((k) => desired.includes(k));

    if (same) continue;

    // Actualizar rol
    try {
      await iamApi.updateRole(
        role._id || role.id,
        {
          code: roleCode,
          name: roleCode,
          description: role.description || roleCode,
          permissions: desired,
        },
        token
      );
      console.log("[seed] rol actualizado:", roleCode);
    } catch (e) {
      console.warn("[seed] no se pudo actualizar rol", roleCode, e?.message || e);
    }
  }

  return { ok: true };
}

/**
 * Helper opcional para consola del navegador.
 * Nota: úsalo solo en entornos controlados (dev/admin), porque puede tocar seguridad (IAM).
 */
if (typeof window !== "undefined") {
  window.seedIam = async (token = null) => {
    try {
      await seedPermissionsAndRoles(token);
      console.log("✅ Seeding completado");
    } catch (e) {
      console.error("❌ Seeding falló:", e);
    }
  };
}
