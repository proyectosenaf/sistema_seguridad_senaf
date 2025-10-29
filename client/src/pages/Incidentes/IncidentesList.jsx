import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";

export default function IncidentesList() {
  const nav = useNavigate();
  const [incidentes, setIncidentes] = useState([]);

  // KPIs
  const [stats, setStats] = useState({
    abiertos: 0,
    enProceso: 0,
    resueltos: 0,
    alta: 0,
  });

  useEffect(() => {
    axios
      .get("http://localhost:4000/api/incidentes")
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : [];
        setIncidentes(data);

        const abiertos = data.filter((i) => i.status === "abierto").length;
        const enProceso = data.filter((i) => i.status === "en_proceso").length;
        const resueltos = data.filter((i) => i.status === "resuelto").length;
        const alta = data.filter((i) => i.priority === "alta").length;

        setStats({
          abiertos,
          enProceso,
          resueltos,
          alta,
        });
      })
      .catch((err) => {
        console.error("Error cargando incidentes", err);
      });
  }, []);

  const actualizarEstado = async (id, nuevoEstado) => {
    try {
      await axios.put(`http://localhost:4000/api/incidentes/${id}`, {
        status: nuevoEstado,
      });

      setIncidentes((prev) =>
        prev.map((inc) =>
          inc._id === id ? { ...inc, status: nuevoEstado } : inc
        )
      );
    } catch (err) {
      console.error("Error actualizando incidente", err);
      alert("No se pudo actualizar el estado");
    }
  };

  return (
    <div className="p-6 text-white max-w-[1400px] mx-auto space-y-6">
      {/* Encabezado + botón reportar */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">
            Gestión de Incidentes
          </h1>
          <p className="text-sm text-gray-400">
            Registra y da seguimiento a incidentes de seguridad
          </p>
        </div>

        <button
          onClick={() => nav("/incidentes/nuevo")}
          className="self-start bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded px-4 py-2"
        >
          + Reportar Incidente
        </button>
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-md p-4 text-white bg-red-600 shadow">
          <div className="text-xs uppercase opacity-80">Incidentes Abiertos</div>
          <div className="text-3xl font-bold">{stats.abiertos}</div>
        </div>

        <div className="rounded-md p-4 text-white bg-blue-600 shadow">
          <div className="text-xs uppercase opacity-80">En Proceso</div>
          <div className="text-3xl font-bold">{stats.enProceso}</div>
        </div>

        <div className="rounded-md p-4 text-white bg-green-600 shadow">
          <div className="text-xs uppercase opacity-80">Resueltos</div>
          <div className="text-3xl font-bold">{stats.resueltos}</div>
        </div>

        <div className="rounded-md p-4 text-white bg-orange-500 shadow">
          <div className="text-xs uppercase opacity-80">Alta Prioridad</div>
          <div className="text-3xl font-bold">{stats.alta}</div>
        </div>
      </div>

      {/* Bloque lista */}
      <div className="bg-[#0f1b2d] border border-gray-700 rounded-md shadow overflow-hidden">
        {/* Header lista */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between p-4 border-b border-gray-700 gap-3">
          <div>
            <div className="text-white font-semibold text-lg">
              Lista de Incidentes
            </div>
            <div className="text-xs text-gray-400">
              Historial de reportes
            </div>
          </div>

          <div className="w-full md:w-1/3">
            <input
              className="w-full bg-[#1e2a3f] text-white text-sm rounded-md px-3 py-2 border border-gray-600 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              placeholder="Buscar por tipo, descripción o zona..."
            />
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-300">
            <thead className="bg-[#1e2a3f] text-gray-400 uppercase text-xs border-b border-gray-700">
              <tr>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Descripción</th>
                <th className="px-3 py-2">Reportado por</th>
                <th className="px-3 py-2">Zona</th>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Prioridad</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {incidentes.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="text-center text-gray-500 py-10 text-sm"
                  >
                    No hay incidentes registrados.
                  </td>
                </tr>
              ) : (
                incidentes.map((i) => (
                  <tr
                    key={i._id}
                    className="border-b border-gray-800 hover:bg-[#1e2a3f]"
                  >
                    <td className="px-3 py-2 text-white font-medium">
                      {i.type}
                    </td>

                    <td className="px-3 py-2 text-gray-300 max-w-[280px] truncate">
                      {i.description}
                    </td>

                    <td className="px-3 py-2">{i.reportedBy}</td>
                    <td className="px-3 py-2">{i.zone}</td>

                    <td className="px-3 py-2 whitespace-nowrap">
                      {new Date(i.date || i.createdAt).toLocaleString()}
                    </td>

                    <td className="px-3 py-2">
                      <span
                        className={
                          "px-2 py-1 rounded text-xs font-semibold uppercase " +
                          (i.priority === "alta"
                            ? "bg-red-600 text-white"
                            : i.priority === "media"
                            ? "bg-yellow-500 text-black"
                            : "bg-green-600 text-white")
                        }
                      >
                        {i.priority}
                      </span>
                    </td>

                    <td className="px-3 py-2">
                      <span
                        className={
                          "px-2 py-1 rounded text-xs font-semibold uppercase " +
                          (i.status === "resuelto"
                            ? "bg-green-700 text-white"
                            : i.status === "en_proceso"
                            ? "bg-blue-600 text-white"
                            : "bg-red-600 text-white")
                        }
                      >
                        {i.status}
                      </span>
                    </td>

                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {i.status === "abierto" && (
                        <button
                          onClick={() =>
                            actualizarEstado(i._id, "en_proceso")
                          }
                          className="text-xs bg-blue-600 hover:bg-blue-700 text-white rounded px-2 py-1 mr-2"
                        >
                          Procesar
                        </button>
                      )}

                      {i.status === "en_proceso" && (
                        <button
                          onClick={() => actualizarEstado(i._id, "resuelto")}
                          className="text-xs bg-green-600 hover:bg-green-700 text-white rounded px-2 py-1"
                        >
                          Resolver
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer con botón */}
        <div className="flex justify-end p-4 border-t border-gray-700">
          <button
            onClick={() => nav("/incidentes/nuevo")}
            className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded px-4 py-2"
          >
            + Reportar Incidente
          </button>
        </div>
      </div>

      {/* enlace volver */}
      <div className="text-sm text-gray-400">
        <Link to="/" className="hover:text-white">
          ← Volver al panel principal
        </Link>
      </div>
    </div>
  );
}
