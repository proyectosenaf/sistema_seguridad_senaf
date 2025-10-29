import React, { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";

export default function IncidenteForm() {
  const nav = useNavigate();

  const [form, setForm] = useState({
    type: "Acceso no autorizado",
    description: "",
    reportedBy: "",
    zone: "",
    priority: "alta",
  });

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      // 1. Guardar en backend
      const res = await axios.post("http://localhost:4000/api/incidentes", form);

      console.log("Incidente creado:", res.data);

      // 2. Redirigir al historial
      nav("/incidentes/lista");
    } catch (error) {
      console.error("Error al enviar incidente:", error);
      alert("Error al reportar el incidente");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#001a12] via-[#00172a] to-[#000000] text-white p-6 max-w-[1000px] mx-auto space-y-6">
      {/* migas */}
      <div className="text-xs text-gray-400 flex flex-wrap items-center gap-2">
        <Link to="/" className="hover:text-white hover:underline underline-offset-4">
          Panel principal
        </Link>
        <span className="text-gray-600">/</span>
        <Link
          to="/incidentes/lista"
          className="hover:text-white hover:underline underline-offset-4"
        >
          Gestión de Incidentes
        </Link>
        <span className="text-gray-600">/</span>
        <span className="text-gray-300">Reportar Incidente</span>
      </div>

      {/* Card */}
      <div className="bg-[#0f1b2d] border border-cyan-400/20 rounded-lg shadow-[0_0_30px_rgba(0,255,255,0.08)] p-6">
        <h2 className="text-xl font-semibold text-white mb-6">
          Reportar Nuevo Incidente
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6 text-sm">
          {/* Tipo */}
          <div>
            <label className="block mb-2 text-gray-300 font-medium">
              Tipo de Incidente
            </label>
            <select
              name="type"
              value={form.type}
              onChange={handleChange}
              className="w-full bg-[#1e2a3f] text-white border border-cyan-400/20 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
            >
              <option>Acceso no autorizado</option>
              <option>Falla técnica</option>
              <option>Objeto perdido</option>
              <option>Otro</option>
            </select>
          </div>

          {/* Descripción */}
          <div>
            <label className="block mb-2 text-gray-300 font-medium">
              Descripción del Incidente
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              className="w-full bg-[#1e2a3f] text-white border border-cyan-400/20 rounded px-3 py-2 min-h-[100px] resize-none focus:outline-none focus:ring-2 focus:ring-cyan-400/40 placeholder-gray-500"
              placeholder="Describa detalladamente lo ocurrido..."
              required
            />
          </div>

          {/* Reportado por */}
          <div>
            <label className="block mb-2 text-gray-300 font-medium">
              Reportado por
            </label>
            <input
              name="reportedBy"
              value={form.reportedBy}
              onChange={handleChange}
              className="w-full bg-[#1e2a3f] text-white border border-cyan-400/20 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 placeholder-gray-500"
              placeholder="Nombre del guardia o responsable"
              required
            />
          </div>

          {/* Zona */}
          <div>
            <label className="block mb-2 text-gray-300 font-medium">
              Zona / Ubicación
            </label>
            <input
              name="zone"
              value={form.zone}
              onChange={handleChange}
              className="w-full bg-[#1e2a3f] text-white border border-cyan-400/20 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 placeholder-gray-500"
              placeholder="Ej. Entrada Principal / Comayagua / Sala Juntas A"
              required
            />
          </div>

          {/* Prioridad */}
          <div>
            <label className="block mb-2 text-gray-300 font-medium">
              Prioridad
            </label>
            <select
              name="priority"
              value={form.priority}
              onChange={handleChange}
              className="w-full bg-[#1e2a3f] text-white border border-cyan-400/20 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
            >
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
          </div>

          {/* Botones */}
          <div className="pt-4 flex flex-col sm:flex-row gap-3 sm:justify-end">
            <button
              type="button"
              onClick={() => nav("/incidentes/lista")}
              className="text-sm bg-transparent border border-gray-500/40 text-gray-300 rounded px-4 py-2
                         hover:text-white hover:border-cyan-400 hover:shadow-[0_0_20px_rgba(0,255,255,0.4)]
                         transition-all duration-300"
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="text-sm bg-green-600 hover:bg-green-700 text-white font-medium rounded px-4 py-2 
                         border border-green-400/40 
                         shadow-[0_0_20px_rgba(0,255,128,0.4)] 
                         hover:shadow-[0_0_40px_rgba(0,255,128,0.8)] 
                         transition-all duration-300"
            >
              Reportar Incidente
            </button>
          </div>
        </form>
      </div>

      <div className="text-xs text-gray-500">
        <Link
          to="/incidentes/lista"
          className="hover:text-white hover:underline underline-offset-4"
        >
          ← Volver a la gestión
        </Link>
      </div>
    </div>
  );
}
