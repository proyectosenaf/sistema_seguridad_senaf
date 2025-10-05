// client/src/iam/IamProvider.jsx
import React from "react";

// Contexto por defecto: que no rompa si aún no envuelves con el provider
const Ctx = React.createContext({
  user: null,
  roles: [],
  perms: [],
  reload: async () => {},
});

export function IamProvider({ children }) {
  const [state, setState] = React.useState({ user: null, roles: [], perms: [] });

  React.useEffect(() => {
    let cancel = false;

    const ROOT = (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000").replace(/\/$/, "");
    const V1 = `${ROOT}/api/iam/v1`;
    const LEGACY = `${ROOT}/api/iam`;

    const candidates = [
      `${V1}/auth/me`,
      `${V1}/me`,
      `${LEGACY}/auth/me`,
      `${LEGACY}/me`,
    ];

    const DEV_HEADERS = {
      "x-user-id": "dev-admin",
      "x-user-email": import.meta.env.VITE_DEV_IAM_EMAIL || "admin@local",
      "x-roles": "admin",
      "x-perms": "*",
    };

    async function fetchMeOnce(useDevHeaders) {
      for (const url of candidates) {
        try {
          const res = await fetch(url, {
            credentials: "include",
            headers: useDevHeaders ? DEV_HEADERS : {},
          });
          if (!res.ok) continue;
          const data = await res.json().catch(() => ({}));
          const user  = data?.user ?? null;
          const roles = data?.roles ?? data?.user?.roles ?? [];
          const perms = data?.permissions ?? data?.perms ?? [];
          return { ok: true, user, roles, perms };
        } catch {
          /* probar siguiente */
        }
      }
      return { ok: false, user: null, roles: [], perms: [] };
    }

    (async () => {
      let result = await fetchMeOnce(false);
      if (!result.ok && import.meta.env.DEV) {
        result = await fetchMeOnce(true);
      }
      if (!cancel) {
        setState({ user: result.user, roles: result.roles, perms: result.perms });
      }
    })();

    return () => { cancel = true; };
  }, []);

  const value = React.useMemo(
    () => ({ ...state, reload: () => Promise.resolve() }),
    [state]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useIam() {
  return React.useContext(Ctx);
}
