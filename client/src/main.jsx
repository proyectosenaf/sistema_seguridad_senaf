// client/src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";

// Estilos globales
import "./styles.css";

// Wrapper de Auth0 que maneja redirect y /start
import Auth0ProviderWithHistory from "./auth/auth0-provider-with-history.jsx";

// 🔹 NUEVO: puente que inyecta el access_token a todas las APIs (incluyendo IAM)
import AuthBridge from "./components/AuthBridge.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Auth0ProviderWithHistory>
        {/* 👇 Este componente NO pinta nada, sólo registra el provider de token */}
        <AuthBridge />
        <App />
      </Auth0ProviderWithHistory>
    </BrowserRouter>
  </React.StrictMode>
);
