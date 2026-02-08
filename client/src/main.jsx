// client/src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./styles.css";
import Auth0ProviderWithHistory from "./auth/auth0-provider-with-history.jsx";

/**
 * ✅ Activa presets globales de UI (sin romper nada)
 * - data-fx: habilita .fx-card y todo lo condicionado por [data-fx]
 * - data-aurora: ajusta intensidades del aurora/glass
 *
 * Nota: En StrictMode puede ejecutarse 2 veces en DEV, pero es idempotente.
 */
(function bootstrapUiTokens() {
  try {
    const el = document.documentElement;
    if (!el.getAttribute("data-fx")) el.setAttribute("data-fx", "neon");
    if (!el.getAttribute("data-aurora")) el.setAttribute("data-aurora", "medio");
  } catch {
    // ignore
  }
})();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Auth0ProviderWithHistory>
        <App />
      </Auth0ProviderWithHistory>
    </BrowserRouter>
  </React.StrictMode>
);
