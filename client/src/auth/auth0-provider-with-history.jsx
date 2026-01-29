// client/src/auth/auth0-provider-with-history.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { Auth0Provider } from "@auth0/auth0-react";

export default function Auth0ProviderWithHistory({ children }) {
  const navigate = useNavigate();

  const domain = import.meta.env.VITE_AUTH0_DOMAIN;
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;

  // ✅ Si el .env no lo trae, usamos el audience correcto por defecto
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE || "https://senaf";

  // ✅ Si en algún momento quieres cambiarlo sin tocar código:
  // VITE_AUTH0_REDIRECT_URI=http://localhost:3000/callback
  const redirectUri =
    import.meta.env.VITE_AUTH0_REDIRECT_URI || `${window.location.origin}/callback`;

  const onRedirectCallback = (appState) => {
    navigate(appState?.returnTo || "/start", { replace: true });
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
      authorizationParams={{
        redirect_uri: redirectUri,

        // 🔥 CLAVE: este debe ser EXACTO a tu API Identifier
        audience: audience,

        // ✅ scopes básicos para SPA
        // (Si luego necesitas refresh tokens reales, se ajusta)
        scope: "openid profile email",
      }}
      onRedirectCallback={onRedirectCallback}
      cacheLocation="localstorage"
      useRefreshTokens={true}
    >
      {children}
    </Auth0Provider>
  );
}
