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
    priority: "alta", // alta / media / baja
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
      await axios.post("http://localhost:4000/api/incidentes", form);
      alert("Incidente reportado correctamente ✅");
      nav("/incidentes/lista"); // redirige al historial
    } catch (error) {
      console.error("Error al enviar incidente:", error);
      alert("Error al reportar el incidente ❌");
    }
  };

  return (
    <div className="p-6 text-white max-w-5xl mx-auto">
      {/* migas / header */}
      <div className="text-sm text-gray-400 mb-4 flex items-center gap-2">
        <Link to="/" className="hover:text-white">Regresar</Link>
        <span>/</span>
        <span className="text-gray-300">Gestión de Incidentes</span>
      </div>

      <div className="bg-[#0f1b2d] border border-gray-700 rounded-md p-5 shadow-lg">
        <h2 className="text-xl font-semibold text-white mb-6">
          Reportar Nuevo Incidente
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6 text-sm">
          {/* Tipo */}
          <div>
            <label className="block mb-2 text-gray-300">Tipo de Incidente</label>
            <select
              name="type"
              value={form.type}
              onChange={handleChange}
              className="w-full bg-[#1e2a3f] text-white border border-gray-600 rounded px-3 py-2"
            >
              <option>Acceso no autorizado</option>
              <option>Falla técnica</option>
              <option>Objeto perdido</option>
              <option>Otro</option>
            </select>
          </div>

          {/* Descripción */}
          <div>
            <label className="block mb-2 text-gray-300">
              Descripción del Incidente
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              className="w-full bg-[#1e2a3f] text-white border border-gray-600 rounded px-3 py-2 min-h-[100px]"
              placeholder="Describa detalladamente lo ocurrido..."
              required
            />
          </div>

          {/* Reportado por */}
          <div>
            <label className="block mb-2 text-gray-300">Reportado por</label>
            <input
              name="reportedBy"
              value={form.reportedBy}
              onChange={handleChange}
              className="w-full bg-[#1e2a3f] text-white border border-gray-600 rounded px-3 py-2"
              placeholder="Nombre del guardia / supervisor"
              required
            />
          </div>

          {/* Zona */}
          <div>
            <label className="block mb-2 text-gray-300">Zona/Ubicación</label>
            <input
              name="zone"
              value={form.zone}
              onChange={handleChange}
              className="w-full bg-[#1e2a3f] text-white border border-gray-600 rounded px-3 py-2"
              placeholder="Ej. Entrada principal, Comayagua, Sala Juntas A..."
              required
            />
          </div>

          {/* Prioridad */}
          <div>
            <label className="block mb-2 text-gray-300">Prioridad</label>
            <select
              name="priority"
              value={form.priority}
              onChange={handleChange}
              className="w-full bg-[#1e2a3f] text-white border border-gray-600 rounded px-3 py-2"
            >
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
            </select>
          </div>

          {/* Botones */}
          <div className="pt-4 flex justify-center">
            <button
              type="submit"
              className="bg-green-600 hover:bg-green-700 text-white font-medium rounded px-4 py-2"
            >
              Reportar Incidente
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
