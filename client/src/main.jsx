import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";

// Estilos globales
import "./styles.css";

// Wrapper de Auth0 que maneja redirect y /start
import Auth0ProviderWithHistory from "./auth/auth0-provider-with-history.jsx";
import AuthBridge from "./components/AuthBridge.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Auth0ProviderWithHistory>
        {/* 🔗 Sincroniza Auth0 -> axios, rondasqrApi, iamApi */}
        <AuthBridge />
        <App />
      </Auth0ProviderWithHistory>
    </BrowserRouter>
  </React.StrictMode>
);
