// client/src/auth/auth0-provider-with-history.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { Auth0Provider } from "@auth0/auth0-react";

export default function Auth0ProviderWithHistory({ children }) {
  const navigate = useNavigate();

  const domain = import.meta.env.VITE_AUTH0_DOMAIN;
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;

  // ✅ Audience: debe coincidir EXACTO con el "Identifier" del API en Auth0
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE || "https://senaf";

  const VITE_ENV = String(import.meta.env.VITE_ENV || "").toLowerCase();
  const MODE = String(import.meta.env.MODE || "").toLowerCase();
  const IS_PROD = VITE_ENV === "production" || MODE === "production";

  // ✅ Callback fijo (tu app ya usa /callback)
  const redirectUri =
    import.meta.env.VITE_AUTH0_REDIRECT_URI || `${window.location.origin}/callback`;

  const onRedirectCallback = (appState) => {
    const returnTo = appState?.returnTo || "/start";

    // si quieres bloquear retornos a rutas (opcional)
    const blockedPrefixes = ["/rondasqr", "/rondas"];
    const isBlocked = blockedPrefixes.some((p) => returnTo.startsWith(p));

    navigate(isBlocked ? "/start" : returnTo, { replace: true });
  };

  if (!(domain && clientId)) {
    console.error(
      "[Auth0ProviderWithHistory] Faltan variables: VITE_AUTH0_DOMAIN o VITE_AUTH0_CLIENT_ID"
    );
    return <div>Configurando Auth0…</div>;
  }

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      onRedirectCallback={onRedirectCallback}
      authorizationParams={{
        redirect_uri: redirectUri,
        audience, // ✅ crítico para que el token salga para TU API
        scope: "openid profile email",
      }}
      /**
       * cacheLocation:
       * - "memory" (más seguro, recomendado en PROD)
       * - "localstorage" (persistente; cuidado si compartes dispositivos)
       */
      cacheLocation={IS_PROD ? "memory" : "localstorage"}
      useRefreshTokens={true}
      useRefreshTokensFallback={true}
    >
      {children}
    </Auth0Provider>
  );
}