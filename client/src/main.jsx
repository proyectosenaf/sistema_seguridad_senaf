import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./styles.css";

import { AuthProvider } from "./pages/auth/AuthProvider.jsx";
import { LayoutUIProvider } from "./components/layout-ui.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <LayoutUIProvider>
          <App />
        </LayoutUIProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);