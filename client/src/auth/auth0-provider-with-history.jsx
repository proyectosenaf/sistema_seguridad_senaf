// client/src/auth/auth0-provider-with-history.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { Auth0Provider } from "@auth0/auth0-react";

export default function Auth0ProviderWithHistory({ children }) {
  const navigate = useNavigate();

  const domain = import.meta.env.VITE_AUTH0_DOMAIN;
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;

  // API Identifier en Auth0 (tu caso: https://senaf)
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE || "https://senaf";

  // Callback fijo y correcto
  const redirectUri =
    import.meta.env.VITE_AUTH0_REDIRECT_URI ||
    `${window.location.origin}/callback`;

  const onRedirectCallback = (appState) => {
    const returnTo = appState?.returnTo || "/start";

    // Si quieres bloquear regresos directos a rondas al reingresar
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
        audience,
        // ✅ Importante para refresh tokens en SPA (si usas useRefreshTokens)
        scope: "openid profile email offline_access",
      }}
      // ✅ Para que el token persista (y el provider lo pueda sacar siempre)
      cacheLocation="localstorage"
      // ✅ Refresh token rotation (requiere configuración en Auth0)
      useRefreshTokens={true}
      // ✅ fallback útil si el browser bloquea cookies en silent auth
      useRefreshTokensFallback={true}
    >
      {children}
    </Auth0Provider>
  );
}
