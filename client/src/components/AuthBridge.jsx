// client/src/components/AuthBridge.jsx

// 🔹 Componente legado:
// Antes se usaba para inyectar el token de Auth0 a la API, Rondas, e IAM
// mediante window.__iamTokenProvider y attachAuth0 / attachRondasAuth.
// Esa lógica ahora está centralizada en App.jsx (AuthTokenBridge),
// así que este componente queda como NO-OP para no causar conflictos.

export default function AuthBridge() {
  return null;
}
