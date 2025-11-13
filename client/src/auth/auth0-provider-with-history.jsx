// src/auth0/Auth0ProviderWithHistory.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { Auth0Provider } from "@auth0/auth0-react";

export default function Auth0ProviderWithHistory({ children }) {
  const navigate = useNavigate();

  const domain = import.meta.env.VITE_AUTH0_DOMAIN;
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

  const onRedirectCallback = (appState) => {
    navigate(appState?.returnTo || "/start");
  };

  if (!(domain && clientId)) {
    return <div>Configurando Auth0…</div>;
  }

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: `${window.location.origin}/callback`,
        ...(audience ? { audience } : {}),
        scope: "openid profile email offline_access",
      }}
      onRedirectCallback={onRedirectCallback}
      useRefreshTokens
      cacheLocation="localstorage"
    >
      {children}
    </Auth0Provider>
  );
}
