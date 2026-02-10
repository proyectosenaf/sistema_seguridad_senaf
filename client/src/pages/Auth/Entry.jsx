import React from "react";
import { useLocation, Navigate } from "react-router-dom";

function safeInternalPath(p) {
  return typeof p === "string" && p.startsWith("/") && !p.startsWith("//");
}

export default function Entry() {
  const { search } = useLocation();
  const qs = new URLSearchParams(search);
  const to = qs.get("to");

  try {
    if (safeInternalPath(to)) sessionStorage.setItem("auth:returnTo", to);
    else sessionStorage.removeItem("auth:returnTo");
  } catch {
    // ignore
  }

  // Siempre fuerza login
  return <Navigate to="/login" replace />;
}
