// client/src/auth/auth0-provider-with-history.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { Auth0Provider } from "@auth0/auth0-react";

export default function Auth0ProviderWithHistory({ children }) {
  const navigate = useNavigate();

  const domain = import.meta.env.VITE_AUTH0_DOMAIN;
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;

  const audience = import.meta.env.VITE_AUTH0_AUDIENCE || "https://senaf";

  const redirectUri =
    import.meta.env.VITE_AUTH0_REDIRECT_URI ||
    `${window.location.origin}/callback`;

  const onRedirectCallback = (appState) => {
    const returnTo = appState?.returnTo || "/start";

    // ✅ Si quieres bloquear que Auth0 te "regrese" a rondas al reingresar,
    // agrega aquí una regla de saneamiento.
    const blockedPrefixes = ["/rondasqr", "/rondas"]; // ajusta si deseas
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
      authorizationParams={{
        redirect_uri: redirectUri,
        audience: audience,
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
