// client/src/config/app.config.js
const env = import.meta.env;

function normPath(p, fallback = "/") {
  const s = String(p || fallback).trim();
  if (!s.startsWith("/")) return "/" + s;
  return s.replace(/\/+$/, "") || "/";
}

function splitList(v) {
  return String(v || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((p) => normPath(p));
}

export const APP_CONFIG = {
  routes: {
    login: normPath(env.VITE_ROUTE_LOGIN, "/login"),
    publicAllowlist: splitList(env.VITE_PUBLIC_ALLOWLIST), // "/login,/public"
  },
  auth: {
    forceLoginOnBoot: String(env.VITE_FORCE_LOGIN_ON_BOOT || "1") === "1",
    clearTokenOnBoot: String(env.VITE_CLEAR_TOKEN_ON_BOOT || "1") === "1",
  },
};