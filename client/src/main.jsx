import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";

import "./styles.css";

import Auth0ProviderWithHistory from "./auth/auth0-provider-with-history.jsx";
// ❌ quita esto:
// import AuthBridge from "./components/AuthBridge.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Auth0ProviderWithHistory>
        {/* 👇 YA NO usamos AuthBridge */}
        <App />
      </Auth0ProviderWithHistory>
    </BrowserRouter>
  </React.StrictMode>
);
