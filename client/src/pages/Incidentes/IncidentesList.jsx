import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";

export default function IncidentesList() {
  const nav = useNavigate();
  const [incidentes, setIncidentes] = useState([]);

  const [stats, setStats] = useState({
    abiertos: 0,
    enProceso: 0,
    resueltos: 0,
    alta: 0,
  });

  // si tus rutas de imagen vienen como /uploads/incidents/xxx.jpg
  // las completamos con el host de la API
  const API_HOST = "http://localhost:4000";

  // cargar historial al montar
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

  // actualizar estado (Procesar / Resolver)
  const actualizarEstado = async (id, nuevoEstado) => {
    try {
      await axios.put(`http://localhost:4000/api/incidentes/${id}`, {
        status: nuevoEstado,
      });

      // reflejarlo en UI sin recargar
      setIncidentes((prev) =>
        prev.map((inc) =>
          inc._id === id ? { ...inc, status: nuevoEstado } : inc
        )
      );

      // actualizar KPIs rápido también
      setStats((prev) => {
        const abiertos =
          nuevoEstado === "en_proceso" || nuevoEstado === "resuelto"
            ? prev.abiertos - 1
            : prev.abiertos;
        const enProceso =
          nuevoEstado === "en_proceso"
            ? prev.enProceso + 1
            : nuevoEstado === "resuelto"
            ? prev.enProceso - 1
            : prev.enProceso;
        const resueltos =
          nuevoEstado === "resuelto"
            ? prev.resueltos + 1
            : prev.resueltos;

        return {
          ...prev,
          abiertos: abiertos < 0 ? 0 : abiertos,
          enProceso: enProceso < 0 ? 0 : enProceso,
          resueltos,
        };
      });
    } catch (err) {
      console.error("Error actualizando incidente", err);
      alert("No se pudo actualizar el estado");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#001a12] via-[#00172a] to-[#000000] text-white p-6 max-w-[1400px] mx-auto space-y-8">
      {/* Encabezado superior */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            Gestión de Incidentes
          </h1>
          <p className="text-sm text-gray-400">
            Registra y da seguimiento a incidentes de seguridad
          </p>
        </div>

        {/* 👉 mismo destino que el sidebar */}
        <button
          onClick={() => nav("/incidentes/nuevo")}
          className="self-start bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded px-4 py-2 
                     border border-red-400/40 
                     shadow-[0_0_20px_rgba(255,0,0,0.4)] 
                     hover:shadow-[0_0_40px_rgba(255,0,0,0.8)] 
                     transition-all duration-300"
        >
          + Reportar Incidente
        </button>
      </div>

      {/* Tarjetas KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* Abiertos */}
        <div
          className="rounded-lg bg-[#0f1b2d] border border-red-400/40 p-4 
                     shadow-[0_0_20px_rgba(255,0,0,0.15)]
                     hover:shadow-[0_0_40px_rgba(255,0,0,0.5)]
                     hover:border-red-400
                     transition-all duration-500 transform hover:-translate-y-1"
        >
          <div className="text-xs uppercase text-red-300 font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(255,0,0,0.8)]" />
            Incidentes Abiertos
          </div>
          <div className="text-3xl font-semibold text-red-400 drop-shadow-[0_0_6px_rgba(255,0,0,0.6)]">
            {stats.abiertos}
          </div>
        </div>

        {/* En Proceso */}
        <div
          className="rounded-lg bg-[#0f1b2d] border border-blue-400/40 p-4
                     shadow-[0_0_20px_rgba(0,128,255,0.15)]
                     hover:shadow-[0_0_40px_rgba(0,128,255,0.5)]
                     hover:border-blue-400
                     transition-all duration-500 transform hover:-translate-y-1"
        >
          <div className="text-xs uppercase text-blue-300 font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(0,128,255,0.8)]" />
            En Proceso
          </div>
          <div className="text-3xl font-semibold text-blue-400 drop-shadow-[0_0_6px_rgba(0,128,255,0.6)]">
            {stats.enProceso}
          </div>
        </div>

        {/* Resueltos */}
        <div
          className="rounded-lg bg-[#0f1b2d] border border-green-400/40 p-4
                     shadow-[0_0_20px_rgba(0,255,128,0.15)]
                     hover:shadow-[0_0_40px_rgba(0,255,128,0.5)]
                     hover:border-green-400
                     transition-all duration-500 transform hover:-translate-y-1"
        >
          <div className="text-xs uppercase text-green-300 font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(0,255,128,0.8)]" />
            Resueltos
          </div>
          <div className="text-3xl font-semibold text-green-400 drop-shadow-[0_0_6px_rgba(0,255,128,0.6)]">
            {stats.resueltos}
          </div>
        </div>

        {/* Alta Prioridad */}
        <div
          className="rounded-lg bg-[#0f1b2d] border border-yellow-400/40 p-4
                     shadow-[0_0_20px_rgba(255,255,0,0.15)]
                     hover:shadow-[0_0_40px_rgba(255,255,0,0.5)]
                     hover:border-yellow-400
                     transition-all duration-500 transform hover:-translate-y-1"
        >
          <div className="text-xs uppercase text-yellow-300 font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(255,255,0,0.8)]" />
            Alta Prioridad
          </div>
          <div className="text-3xl font-semibold text-yellow-300 drop-shadow-[0_0_6px_rgba(255,255,0,0.6)]">
            {stats.alta}
          </div>
        </div>
      </div>

      {/* Bloque Lista de Incidentes */}
      <div className="bg-[#0f1b2d] border border-cyan-400/20 rounded-lg shadow-[0_0_30px_rgba(0,255,255,0.08)] overflow-hidden">
        {/* Header Lista */}
        <div className="flex flex-col md:flex-row justify-between items-center p-4 border-b border-cyan-400/10 gap-3">
          <div>
            <h2 className="font-semibold text-lg text-white">
              Lista de Incidentes
            </h2>
            <p className="text-xs text-gray-400">
              Historial de reportes registrados en el sistema
            </p>
          </div>

          <div className="w-full md:w-1/3">
            <input
              className="w-full bg-[#1e2a3f] text-white text-sm rounded-md px-3 py-2 
                         border border-cyan-400/20 placeholder-gray-500 
                         focus:outline-none focus:ring-2 focus:ring-cyan-400/40 
                         transition-all duration-200"
              placeholder="Buscar por tipo, descripción o zona..."
            />
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-200">
            <thead className="bg-[#1e2a3f] text-gray-400 uppercase text-xs border-b border-cyan-400/10">
              <tr>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Descripción</th>
                <th className="px-4 py-3 font-medium">Reportado por</th>
                <th className="px-4 py-3 font-medium">Zona</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Prioridad</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Evidencias</th>
                <th className="px-4 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {incidentes.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="text-center text-gray-500 py-10 text-sm"
                  >
                    No hay incidentes registrados.
                  </td>
                </tr>
              ) : (
                incidentes.map((i) => {
                  // 👇 aquí está el cambio importante
                  const photos =
                    Array.isArray(i.photos) && i.photos.length
                      ? i.photos
                      : Array.isArray(i.photosBase64)
                      ? i.photosBase64
                      : [];

                  return (
                    <tr
                      key={i._id}
                      className="border-b border-cyan-400/5 hover:bg-[#1b2d44] transition-colors"
                    >
                      <td className="px-4 py-3 text-white font-medium">
                        {i.type}
                      </td>

                      <td className="px-4 py-3 text-gray-300 max-w-[320px] truncate">
                        {i.description}
                      </td>

                      <td className="px-4 py-3 text-gray-200">
                        {i.reportedBy}
                      </td>

                      <td className="px-4 py-3 text-gray-200">{i.zone}</td>

                      <td className="px-4 py-3 whitespace-nowrap text-gray-400 text-xs">
                        {new Date(i.date || i.createdAt).toLocaleString()}
                      </td>

                      {/* PRIORIDAD */}
                      <td className="px-4 py-3">
                        <span
                          className={
                            "px-2 py-1 rounded text-[11px] font-semibold uppercase tracking-wide " +
                            (i.priority === "alta"
                              ? "bg-red-600/20 text-red-400 border border-red-500/40 shadow-[0_0_8px_rgba(255,0,0,0.5)]"
                              : i.priority === "media"
                              ? "bg-yellow-400/20 text-yellow-300 border border-yellow-400/40 shadow-[0_0_8px_rgba(255,255,0,0.4)]"
                              : "bg-green-600/20 text-green-400 border border-green-500/40 shadow-[0_0_8px_rgba(0,255,128,0.5)]")
                          }
                        >
                          {i.priority}
                        </span>
                      </td>

                      {/* ESTADO */}
                      <td className="px-4 py-3">
                        <span
                          className={
                            "px-2 py-1 rounded text-[11px] font-semibold uppercase tracking-wide " +
                            (i.status === "resuelto"
                              ? "bg-green-600/20 text-green-400 border border-green-500/40 shadow-[0_0_8px_rgba(0,255,128,0.5)]"
                              : i.status === "en_proceso"
                              ? "bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-[0_0_8px_rgba(0,128,255,0.5)]"
                              : "bg-red-600/20 text-red-400 border border-red-500/40 shadow-[0_0_8px_rgba(255,0,0,0.5)]")
                          }
                        >
                          {i.status === "en_proceso"
                            ? "En proceso"
                            : i.status === "resuelto"
                            ? "Resuelto"
                            : "Abierto"}
                        </span>
                      </td>

                      {/* EVIDENCIAS */}
                      <td className="px-4 py-3">
                        {photos.length ? (
                          <div className="flex gap-2">
                            {photos.slice(0, 3).map((p, idx) => {
                              // si es base64 lo usamos tal cual, si no le agregamos el host
                              const src =
                                typeof p === "string" &&
                                (p.startsWith("http") ||
                                  p.startsWith("data:image"))
                                  ? p
                                  : `${API_HOST}${p}`;
                              return (
                                <a
                                  key={idx}
                                  href={src}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block w-12 h-12 rounded overflow-hidden border border-cyan-400/20 bg-black/30"
                                >
                                  <img
                                    src={src}
                                    alt="evidencia"
                                    className="w-full h-full object-cover"
                                  />
                                </a>
                              );
                            })}
                            {photos.length > 3 && (
                              <span className="text-xs text-gray-400">
                                +{photos.length - 3}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">—</span>
                        )}
                      </td>

                      {/* ACCIONES */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {i.status === "abierto" && (
                          <button
                            onClick={() =>
                              actualizarEstado(i._id, "en_proceso")
                            }
                            className="text-[11px] bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-1 
                                     border border-blue-400/40 
                                     shadow-[0_0_15px_rgba(0,128,255,0.5)] 
                                     hover:shadow-[0_0_30px_rgba(0,128,255,0.8)] 
                                     transition-all duration-300"
                          >
                            Procesar
                          </button>
                        )}

                        {i.status === "en_proceso" && (
                          <button
                            onClick={() =>
                              actualizarEstado(i._id, "resuelto")
                            }
                            className="text-[11px] bg-green-600 hover:bg-green-700 text-white rounded px-3 py-1 
                                     border border-green-400/40 
                                     shadow-[0_0_15px_rgba(0,255,128,0.4)] 
                                     hover:shadow-[0_0_30px_rgba(0,255,128,0.7)] 
                                     transition-all duration-300"
                          >
                            Resolver
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer con botón Crear */}
        <div className="flex justify-end p-4 border-t border-cyan-400/10">
          <button
            onClick={() => nav("/incidentes/nuevo")}
            className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded px-4 py-2 
                       border border-red-400/40 
                       shadow-[0_0_20px_rgba(255,0,0,0.4)] 
                       hover:shadow-[0_0_40px_rgba(255,0,0,0.8)] 
                       transition-all duration-300"
          >
            + Reportar Incidente
          </button>
        </div>
      </div>

      {/* link volver */}
      <div className="text-xs text-gray-500">
        <Link
          to="/"
          className="hover:text-white hover:underline underline-offset-4 transition-colors"
        >
          ← Volver al panel principal
        </Link>
      </div>
    </div>
  );
}
