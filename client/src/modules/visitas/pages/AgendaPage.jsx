import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AgendaPage() {
  const navigate = useNavigate();

  // Citas de ejemplo
  const [citas, setCitas] = useState([
    {
      id: 101,
      visitante: "Juan Pérez",
      empresa: "Innova Consulting",
      empleado: "Ana García",
      motivo: "Reunión comercial",
      fecha: "20/09/2025",
      hora: "10:30",
      estado: "Programada",
    },
    {
      id: 102,
      visitante: "Laura Gómez",
      empresa: "Servicios Integrales",
      empleado: "Luis Martínez",
      motivo: "Entrega de documentos",
      fecha: "20/09/2025",
      hora: "11:00",
      estado: "Programada",
    },
    {
      id: 103,
      visitante: "Pedro Fuentes",
      empresa: "Tech Solutions S.A.",
      empleado: "Pedro Hernández",
      motivo: "Mantenimiento",
      fecha: "20/09/2025",
      hora: "14:00",
      estado: "En sitio",
    },
  ]);

  function handleCheckIn(id) {
    setCitas((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              estado: "En sitio",
            }
          : c
      )
    );
  }

  return (
    <div className="layer-content relative z-[1] flex flex-col gap-6">
      {/* fondo FX */}
      <div className="mesh mesh--ribbon" />
      <div className="mesh mesh--br" />
      <div className="mesh mesh--lb" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex flex-col">
          <h1 className="text-xl md:text-2xl font-bold text-neutral-100 dark:text-neutral-100">
            Agenda de Citas
          </h1>
          <p className="text-sm text-neutral-400">
            Citas programadas con ingreso controlado
          </p>
        </div>

        <div className="flex flex-col items-start md:items-end gap-2">
          <button
            onClick={() => navigate("/visitas/control")}
            className="text-xs text-blue-400 hover:underline"
          >
            ← Volver a Gestión de Visitantes
          </button>
        </div>
      </div>

      {/* Tabla de citas */}
      <section className="relative z-[2] visits-shell card-rich p-4 md:p-5 overflow-x-auto text-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
          <div className="font-semibold text-neutral-200 text-base">
            Citas Programadas Hoy
          </div>

          {/* en futuro aquí puedes poner filtro por estado / fecha */}
        </div>

        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead className="text-xs uppercase text-neutral-400 border-b border-neutral-700/40">
            <tr className="[&>th]:py-2 [&>th]:pr-4">
              <th>Visitante</th>
              <th>Empresa</th>
              <th>Empleado</th>
              <th>Motivo</th>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Estado</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>

          <tbody className="text-neutral-200">
            {citas.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="py-6 text-center text-neutral-500 text-sm"
                >
                  Sin citas programadas
                </td>
              </tr>
            ) : (
              citas.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-neutral-800/40 text-sm [&>td]:py-3 [&>td]:pr-4"
                >
                  <td className="font-medium text-neutral-100">
                    {c.visitante}
                  </td>
                  <td className="text-neutral-200">{c.empresa}</td>
                  <td className="text-neutral-200">{c.empleado}</td>
                  <td className="text-neutral-300">{c.motivo}</td>
                  <td className="text-neutral-200">{c.fecha}</td>
                  <td className="text-neutral-200">{c.hora}</td>
                  <td>
                    {c.estado === "En sitio" ? (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-200 text-green-700 dark:bg-green-600/20 dark:text-green-300">
                        En sitio
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-yellow-200 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300">
                        Programada
                      </span>
                    )}
                  </td>
                  <td className="text-right">
                    {c.estado === "Programada" ? (
                      <button
                        onClick={() => handleCheckIn(c.id)}
                        className="px-2 py-1 rounded-md text-xs font-semibold bg-blue-200 text-blue-700 hover:bg-blue-300 dark:bg-blue-600/20 dark:text-blue-300 dark:hover:bg-blue-600/30"
                      >
                        ✔ Check-in
                      </button>
                    ) : (
                      <span className="text-neutral-500 text-xs">
                        (registrada)
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
