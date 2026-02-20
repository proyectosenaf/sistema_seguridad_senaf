// Componente de ruta protegida que verifica la autenticación del usuario
// Creado el 19/02/2026 para implementar Login, cambio de contraseña y vencimiento, sin auth0
import React from "react";
import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
// Componente de ruta protegida que verifica la autenticación del usuario
// Creado el 19/02/2026 para implementar Login, cambio de contraseña y vencimiento, sin auth0