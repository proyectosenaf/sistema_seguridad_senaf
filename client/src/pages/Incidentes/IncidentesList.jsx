// src/pages/Incidentes/IncidentesList.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

export default function IncidentesList() {
  const [incidentes, setIncidentes] = useState([]);

  const [stats, setStats] = useState({
    abiertos: 0,
    enProceso: 0,
    resueltos: 0,
    alta: 0,
  });

  // mostrar/ocultar formulario
  const [showForm, setShowForm] = useState(false);

  // campos del formulario
  const [form, setForm] = useState({
    type: "",
    description: "",
    reportedBy: "",
    zone: "",
    priority: "media",
  });
  const [files, setFiles] = useState([]);

  const API_BASE = "http://localhost:4000";
  const API_HOST = "http://localhost:4000";

  // ───────────────────────────────
  // Helpers
  // ───────────────────────────────
  function recomputeStats(list) {
    const abiertos = list.filter((i) => i.status === "abierto").length;
    const enProceso = list.filter((i) => i.status === "en_proceso").length;
    const resueltos = list.filter((i) => i.status === "resuelto").length;
    const alta = list.filter((i) => i.priority === "alta").length;
    setStats({ abiertos, enProceso, resueltos, alta });
  }

  // ───────────────────────────────
  // Cargar historial al montar
  // ───────────────────────────────
  useEffect(() => {
    axios
      .get(`${API_BASE}/api/incidentes`)
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : [];
        setIncidentes(data);
        recomputeStats(data);
      })
      .catch((err) => {
        console.error("Error cargando incidentes", err);
      });
  }, []);

  // ───────────────────────────────
  // Actualizar estado de un incidente (Procesar / Resolver)
  // ───────────────────────────────
  const actualizarEstado = async (id, nuevoEstado) => {
    try {
      await axios.put(`${API_BASE}/api/incidentes/${id}`, {
        status: nuevoEstado,
      });

      const next = incidentes.map((inc) =>
        inc._id === id ? { ...inc, status: nuevoEstado } : inc
      );
      setIncidentes(next);
      recomputeStats(next);
    } catch (err) {
      console.error("Error actualizando incidente", err);
      alert("No se pudo actualizar el estado");
    }
  };

  // ───────────────────────────────
  // Enviar nuevo incidente SIN redirigir
  // ───────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      // si tu backend espera multipart (porque puede traer fotos)
      const fd = new FormData();
      fd.append("type", form.type);
      fd.append("description", form.description);
      fd.append("reportedBy", form.reportedBy);
      fd.append("zone", form.zone);
      fd.append("priority", form.priority);
      // status por defecto
      fd.append("status", "abierto");

      // adjuntar fotos si hay
      Array.from(files || []).forEach((file) => {
        fd.append("photos", file);
      });

      const res = await axios.post(`${API_BASE}/api/incidentes`, fd, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      // el backend debería devolver el incidente creado
      const creado = res.data;

      // meterlo al principio de la lista
      const next = [creado, ...incidentes];
      setIncidentes(next);
      recomputeStats(next);

      // limpiar formulario
      setForm({
        type: "",
        description: "",
        reportedBy: "",
        zone: "",
        priority: "media",
      });
      setFiles([]);
      setShowForm(false);
    } catch (err) {
      console.error("Error creando incidente", err);
      alert("No se pudo crear el incidente. Revisa la consola.");
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

        {/* 👉 ya no navegamos, solo mostramos el form */}
        <button
          onClick={() => setShowForm((v) => !v)}
          className="self-start bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded px-4 py-2 
                     border border-red-400/40 
                     shadow-[0_0_20px_rgba(255,0,0,0.4)] 
                     hover:shadow-[0_0_40px_rgba(255,0,0,0.8)] 
                     transition-all duration-300"
        >
          {showForm ? "Cerrar formulario" : "+ Reportar Incidente"}
        </button>
      </div>

      {/* Formulario inline */}
      {showForm && (
        <div className="bg-[#0f1b2d] border border-red-400/30 rounded-lg p-5 space-y-4">
          <h2 className="text-lg font-semibold text-white">
            Nuevo incidente
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1">
                Tipo de incidente
              </label>
              <input
                required
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full bg-[#1e2a3f] border border-slate-600/40 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400/50"
                placeholder="Ej. Intrusión, Daño, Robo…"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">
                Reportado por
              </label>
              <input
                value={form.reportedBy}
                onChange={(e) =>
                  setForm({ ...form, reportedBy: e.target.value })
                }
                className="w-full bg-[#1e2a3f] border border-slate-600/40 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400/50"
                placeholder="Nombre del guardia / sistema"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-gray-400 block mb-1">
                Descripción
              </label>
              <textarea
                required
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                className="w-full bg-[#1e2a3f] border border-slate-600/40 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400/50 min-h-[80px]"
                placeholder="Describe qué pasó…"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">
                Zona / Ubicación
              </label>
              <input
                value={form.zone}
                onChange={(e) => setForm({ ...form, zone: e.target.value })}
                className="w-full bg-[#1e2a3f] border border-slate-600/40 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400/50"
                placeholder="Ej. Bodega, Entrada principal…"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">
                Prioridad
              </label>
              <select
                value={form.priority}
                onChange={(e) =>
                  setForm({ ...form, priority: e.target.value })
                }
                className="w-full bg-[#1e2a3f] border border-slate-600/40 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400/50"
              >
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-gray-400 block mb-1">
                Evidencias (fotos)
              </label>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => setFiles(e.target.files)}
                className="text-sm"
              />
            </div>
            <div className="md:col-span-2 flex gap-2">
              <button
                type="submit"
                className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded px-4 py-2 transition-all"
              >
                Guardar incidente
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-slate-700/60 hover:bg-slate-700 text-white text-sm font-medium rounded px-4 py-2 transition-all"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

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
                <th className="px-4 py-3 font-medium">TIPO</th>
                <th className="px-4 py-3 font-medium">DESCRIPCIÓN</th>
                <th className="px-4 py-3 font-medium">REPORTADO POR</th>
                <th className="px-4 py-3 font-medium">ZONA</th>
                <th className="px-4 py-3 font-medium">FECHA</th>
                <th className="px-4 py-3 font-medium">PRIORIDAD</th>
                <th className="px-4 py-3 font-medium">ESTADO</th>
                <th className="px-4 py-3 font-medium">EVIDENCIAS</th>
                <th className="px-4 py-3 font-medium text-right">ACCIONES</th>
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
            onClick={() => setShowForm((v) => !v)}
            className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded px-4 py-2 
                       border border-red-400/40 
                       shadow-[0_0_20px_rgba(255,0,0,0.4)] 
                       hover:shadow-[0_0_40px_rgba(255,0,0,0.8)] 
                       transition-all duration-300"
          >
            {showForm ? "Cerrar formulario" : "+ Reportar Incidente"}
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
