import { permisosKeys, rolesKeys } from "../catalog/perms";
import { iamApi } from "../api/iamApi";

/**
 * Crea (si faltan) las entradas de /permissions a partir del catálogo local.
 * Luego asegura que los roles existan y tengan asignadas sus permissions.
 * IMPORTANTE: Debes pasarle un access token válido (Auth0) con AUDIENCE correcto.
 *
 * Ejemplo desde React:
 *   const token = await getAccessTokenSilently({
 *     authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE }
 *   });
 *   await seedPermissionsAndRoles(token);
 */
export async function seedPermissionsAndRoles(token) {
  if (!token) {
    console.warn(
      "[seed] WARNING: seedPermissionsAndRoles llamado SIN token; la API responderá 401."
    );
  }

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
    existingPerms.map((p) => p.key || p.name).filter(Boolean)
  );

  // Crear los que falten
  for (const [key, label] of Object.entries(permisosKeys)) {
    if (!existingSet.has(key)) {
      const group = key.split(".")[0];
      const order = 0;
      try {
        await iamApi.createPerm({ key, label, group, order }, token);
        existingSet.add(key);
        // eslint-disable-next-line no-console
        console.log("[seed] permiso creado:", key);
      } catch (e) {
        console.warn(
          "[seed] no se pudo crear permiso",
          key,
          e?.message || e
        );
      }
    }
  }

  // Releer (opcional)
  try {
    const res = await iamApi.listPerms(token);
    existingPerms = res?.items || res?.permissions || [];
  } catch (e) {
    console.warn(
      "[seed] no se pudo volver a listar permisos:",
      e?.message || e
    );
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

  const roleIdx = new Map();
  for (const r of existingRoles) {
    const key = r?.key || r?.name || r?._id || "";
    if (!key) continue;
    roleIdx.set(key, r);
  }

  for (const [roleKey, permList] of Object.entries(rolesKeys)) {
    const role = roleIdx.get(roleKey);
    const desired = Array.isArray(permList) ? permList : [];

    if (!role) {
      try {
        await iamApi.createRole(
          {
            key: roleKey,
            name: roleKey,
            description: "",
            permissions: desired,
          },
          token
        );
        console.log("[seed] rol creado:", roleKey);
      } catch (e) {
        console.warn(
          "[seed] no se pudo crear rol",
          roleKey,
          e?.message || e
        );
      }
    } else {
      const current = Array.isArray(role.permissionKeys || role.permissions || role.perms)
        ? role.permissionKeys || role.permissions || role.perms
        : [];
      const same =
        current.length === desired.length &&
        current.every((k) => desired.includes(k));

      if (!same) {
        try {
          await iamApi.updateRole(
            role._id || role.id,
            {
              key: roleKey,
              name: roleKey,
              description: role.description || "",
              permissions: desired,
            },
            token
          );
          console.log("[seed] rol actualizado:", roleKey);
        } catch (e) {
          console.warn(
            "[seed] no se pudo actualizar rol",
            roleKey,
            e?.message || e
          );
        }
      }
    }
  }

  return { ok: true };
}

// Helper para usar desde consola del navegador si quieres:
if (typeof window !== "undefined") {
  // eslint-disable-next-line no-console
  console.log(
    '➡️  Puedes ejecutar "window.seedIam(ACCESS_TOKEN)" para llenar permisos/roles.\n' +
      "   Ejemplo: const t = 'eyJ...'; window.seedIam(t);"
  );

  // Permite pasar el token manualmente desde consola
  window.seedIam = async (token) => {
    try {
      await seedPermissionsAndRoles(token);
      console.log("✅ Seeding completado");
    } catch (e) {
      console.error("❌ Seeding falló:", e);
    }
  };
}
