import React from "react";

export default function ManualsPage() {
  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-semibold">Manuales</h1>
      <ul className="list-disc pl-5 space-y-2">
        <li><a className="text-blue-300 underline" href="/manuales/rondasqr-usuario.pdf" target="_blank" rel="noreferrer">Manual de Usuario</a></li>
        <li><a className="text-blue-300 underline" href="/manuales/rondasqr-admin.pdf" target="_blank" rel="noreferrer">Manual de Administrador</a></li>
      </ul>
    </div>
  );
}
