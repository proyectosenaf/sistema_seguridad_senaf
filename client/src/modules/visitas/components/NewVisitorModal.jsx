import React, { useState } from "react";

export default function NewVisitorModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({
    name: "",
    document: "",
    company: "",
    phone: "",
    email: "",
    employee: "",
    reason: "",
  });

  const [saving, setSaving] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function handleSave() {
    if (!form.name.trim() || !form.document.trim() || !form.reason.trim()) {
      alert("Por favor llene Nombre, Documento y Motivo.");
      return;
    }

    setSaving(true);
    try {
      // devolvemos al padre los datos crudos, el padre llama POST /api/visitas
      await onSubmit(form);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl bg-white text-neutral-900 shadow-xl dark:bg-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700">
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-neutral-200 dark:border-neutral-700">
          <h2 className="text-lg font-semibold">Registrar Nuevo Visitante</h2>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
          >
            ✕
          </button>
        </div>

        {/* Body / Form */}
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex flex-col gap-1">
            <label className="font-medium">
              Nombre Completo <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              className="input-fx"
              placeholder="Ingrese el nombre"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-medium">
              Documento <span className="text-red-500">*</span>
            </label>
            <input
              name="document"
              value={form.document}
              onChange={handleChange}
              required
              className="input-fx"
              placeholder="Número de documento"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-medium">Empresa</label>
            <input
              name="company"
              value={form.company}
              onChange={handleChange}
              className="input-fx"
              placeholder="Nombre de la empresa"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-medium">Teléfono</label>
            <input
              name="phone"
              value={form.phone}
              onChange={handleChange}
              className="input-fx"
              placeholder="Número de teléfono"
            />
          </div>

          <div className="flex flex-col gap-1 md:col-span-2">
            <label className="font-medium">Email</label>
            <input
              name="email"
              value={form.email}
              onChange={handleChange}
              className="input-fx"
              placeholder="correo@ejemplo.com"
            />
          </div>

          <div className="flex flex-col gap-1 md:col-span-2">
            <label className="font-medium">Empleado a Visitar</label>
            <input
              name="employee"
              value={form.employee}
              onChange={handleChange}
              className="input-fx"
              placeholder="Ej. Ana García"
            />
          </div>

          <div className="flex flex-col gap-1 md:col-span-2">
            <label className="font-medium">
              Motivo de la Visita <span className="text-red-500">*</span>
            </label>
            <textarea
              name="reason"
              value={form.reason}
              onChange={handleChange}
              className="input-fx min-h-[80px] resize-none"
              placeholder="Describa el motivo de la visita"
            />
          </div>
        </div>

        {/* Footer / Actions */}
        <div className="p-4 flex justify-end gap-3 border-t border-neutral-200 dark:border-neutral-700">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            disabled={saving}
          >
            Cancelar
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-neon text-sm px-4 py-2 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Guardando…" : "Registrar Visitante"}
          </button>
        </div>
      </div>
    </div>
  );
}
