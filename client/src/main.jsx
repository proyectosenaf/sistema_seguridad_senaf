// src/main.jsx
import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import App from "./App.jsx";

// Estilos globales
import "./styles.css";

// Inyectores de token a tus capas de red
import { attachAuth0 } from "./lib/api.js";
import { attachRondasAuth } from "./modules/rondasqr/api/rondasqrApi.js";

// 🔗 Puente interno entre Auth0 y tus APIs (axios / rondasqrApi)
function AuthBridge() {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    const wireProviders = async () => {
      if (!isAuthenticated) {
        // Si el usuario NO está autenticado, limpia los providers
        attachAuth0(null);
        attachRondasAuth(null);
        return;
      }

      // Un único provider reutilizable para todas tus libs
      const provider = async () => {
        try {
          const token = await getAccessTokenSilently({
            authorizationParams: {
              audience: import.meta.env.VITE_AUTH0_AUDIENCE,
              scope: "openid profile email offline_access",
            },
          });
          return token || null;
        } catch (err) {
          console.warn(
            "[AuthBridge] no se pudo obtener token:",
            err?.message || err
          );
          return null;
        }
      };

      attachAuth0(provider);
      attachRondasAuth(provider);
    };

    wireProviders();
  }, [isAuthenticated, getAccessTokenSilently]);

  return null;
}

const domain = import.meta.env.VITE_AUTH0_DOMAIN;
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Auth0Provider
        domain={domain}
        clientId={clientId}
        authorizationParams={{
          // 🔥 más simple: volvemos siempre a /
          redirect_uri: window.location.origin,
          ...(audience ? { audience } : {}),
          scope: "openid profile email offline_access",
        }}
        useRefreshTokens={true}
        cacheLocation="localstorage"
      >
        {/* 🔗 Aquí sincronizamos Auth0 -> api / rondasqrApi */}
        <AuthBridge />
        <App />
      </Auth0Provider>
    </BrowserRouter>
  </React.StrictMode>
);
