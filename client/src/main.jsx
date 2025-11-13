// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Auth0Provider } from "@auth0/auth0-react";
import App from "./App.jsx";

// 👈 IMPORTA AQUÍ TUS ESTILOS (Tailwind / CSS global)
import "./styles.css";
   // o "./styles.css" según como se llame tu archivo

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
          // Auth0 redirige aquí tras login/logout
          redirect_uri: `${window.location.origin}/callback`,
          ...(audience ? { audience } : {}),
          scope: "openid profile email offline_access",
        }}
        useRefreshTokens={true}
        cacheLocation="localstorage"
      >
        <App />
      </Auth0Provider>
    </BrowserRouter>
  </React.StrictMode>
);
