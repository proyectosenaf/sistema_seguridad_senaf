// client/src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./styles.css";
import Auth0ProviderWithHistory from "./auth/auth0-provider-with-history.jsx";
import AttachAuth0ToApi from "./auth/attach-auth0-to-api.jsx"; // ✅ NUEVO

/**
 * Presets globales UI
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
        <AttachAuth0ToApi /> {/* ✅ NUEVO: registra token provider en axios */}
        <App />
      </Auth0ProviderWithHistory>
    </BrowserRouter>
  </React.StrictMode>
);