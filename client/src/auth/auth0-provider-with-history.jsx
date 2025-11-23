// client/src/auth/auth0-provider-with-history.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { Auth0Provider } from "@auth0/auth0-react";

// 👇 IMPORTA EL BRIDGE
import AuthBridge from "../components/AuthBridge.jsx";

export default function Auth0ProviderWithHistory({ children }) {
  const navigate = useNavigate();

  const domain = import.meta.env.VITE_AUTH0_DOMAIN;
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

  const onRedirectCallback = (appState) => {
    // Respetar returnTo si viene desde loginWithRedirect({ appState: { returnTo: ... } })
    navigate(appState?.returnTo || "/start", { replace: true });
  };

  if (!(domain && clientId)) {
    return <div>Configurando Auth0…</div>;
  }

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        // callback fijo que coincide con tu ruta /callback en App.jsx
        redirect_uri: `${window.location.origin}/callback`,
        ...(audience ? { audience } : {}),
        scope: "openid profile email offline_access",
      }}
      onRedirectCallback={onRedirectCallback}
      useRefreshTokens={true}
      cacheLocation="localstorage"
    >
      {/* 👇 AQUÍ se monta el bridge que conecta Auth0 → Axios / Rondas / IAM */}
      <AuthBridge />
      {children}
    </Auth0Provider>
  );
}
