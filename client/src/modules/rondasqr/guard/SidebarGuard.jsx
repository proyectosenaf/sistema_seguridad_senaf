// client/src/modules/rondasqr/guard/SidebarGuard.jsx
import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Home, AlertTriangle, QrCode, MessageSquare, Layers,
  Upload, Pencil, FileBarChart, Camera, Send, Database,
  Settings, LogOut, BookOpen, Info, Languages
} from "lucide-react";
import { rondasqrApi } from "../api/rondasqrApi";

/** Sidebar tipo Centor con navegación + acciones por defecto */
export default function SidebarGuard({ onSelect }) {
  const navigate = useNavigate();

  // Acciones por defecto si el padre no provee onSelect
  const defaultAction = async (key) => {
    try {
      switch (key) {
        case "alert": {
          // Geolocalización si está disponible (no bloquea si falla)
          let gps;
          if ("geolocation" in navigator) {
            await new Promise((resolve) => {
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  gps = { lat: pos.coords.latitude, lon: pos.coords.longitude };
                  resolve();
                },
                () => resolve(),
                { enableHighAccuracy: true, timeout: 5000 }
              );
            });
          }
          await rondasqrApi.panic(gps);
          window.alert("🚨 Alerta de pánico enviada.");
          break;
        }
        case "msg":
          navigate("/incidentes/nuevo");
          break;

        case "photo":
          window.alert("📷 Enviar foto: pendiente de implementar en esta vista.");
          break;

        case "tx":
          window.alert("⬆️ Transmitir Rondas: pendiente de implementar.");
          break;

        case "dumpdb":
          window.alert("💾 Enviar base de datos: pendiente de implementar.");
          break;

        case "config":
          window.alert("⚙️ Configurar: pendiente de implementar.");
          break;

        case "manuals":
          window.open("https://example.com/manual.pdf", "_blank", "noopener,noreferrer");
          break;

        case "about":
          window.alert("ℹ️ SENAF · Módulo Rondas QR");
          break;

        case "lang":
          window.alert("🌐 Cambio de idioma: pendiente de implementar.");
          break;

        case "logout":
          navigate("/login");
          break;

        default:
          break;
      }
    } catch (err) {
      console.error("[Sidebar defaultAction]", err);
      window.alert("Ocurrió un error ejecutando la acción.");
    }
  };

  // Si el padre no pasa onSelect usamos defaultAction
  const emit = (key) => (onSelect ? onSelect(key) : defaultAction(key));

  // Ítems de navegación directa (usan <NavLink />)
  const navItems = [
    { key: "home",   label: "Hogar",                        icon: <Home size={18} />,       to: "/rondasqr/scan",  end: true },
    { key: "scan",   label: "Registrador Punto Control",    icon: <QrCode size={18} />,     to: "/rondasqr/scan" },
    { key: "reports",label: "Informes",                     icon: <FileBarChart size={18} />, to: "/rondasqr/panel" },
    { key: "create", label: "Crear rondas",                 icon: <Layers size={18} />,     to: "/rondasqr/admin" },
    { key: "load",   label: "Cargar rondas",                icon: <Upload size={18} />,     to: "/rondasqr/admin" },
    { key: "edit",   label: "Editar Rondas",                icon: <Pencil size={18} />,     to: "/rondasqr/admin" },
    { key: "inicio", label: "Inicio",                       icon: <Home size={18} />,       to: "/start" },
  ];

  // Ítems que ejecutan acciones (botones)
  const actionItems = [
    { key: "alert",   label: "Enviar Alerta",      icon: <AlertTriangle size={18} /> },
    { key: "msg",     label: "Mensaje Incidente",  icon: <MessageSquare size={18} /> },
    { key: "photo",   label: "Enviar foto",        icon: <Camera size={18} /> },
    { key: "tx",      label: "Transmitir Rondas",  icon: <Send size={18} /> },
    { key: "dumpdb",  label: "Enviar base de datos", icon: <Database size={18} /> },
    { key: "config",  label: "Configurar",         icon: <Settings size={18} /> },
    { key: "manuals", label: "Manuales",           icon: <BookOpen size={18} /> },
    { key: "about",   label: "Acerca",             icon: <Info size={18} /> },
    { key: "lang",    label: "Idioma",             icon: <Languages size={18} /> },
    { key: "logout",  label: "Salir App",          icon: <LogOut size={18} /> },
  ];

  return (
    <aside className="w-64 bg-[#0b4c7c] text-white flex flex-col py-4 rounded-r-2xl shadow-2xl">
      <div className="px-5 mb-4">
        <div className="text-2xl font-extrabold tracking-wide">CENTRO</div>
        <div className="text-xs opacity-80">Visión del Guardia</div>
      </div>

      <nav className="flex-1 overflow-auto">
        {navItems.map((it) => (
          <NavLink
            key={it.key}
            to={it.to}
            end={it.end}
            className={({ isActive }) =>
              `w-full px-5 py-2.5 flex items-center gap-3 text-left transition ${
                isActive ? "bg-white/15" : "hover:bg-white/10"
              }`
            }
          >
            {it.icon}
            <span className="text-sm font-medium">{it.label}</span>
          </NavLink>
        ))}

        {actionItems.map((it) => (
          <button
            key={it.key}
            onClick={() => emit(it.key)}
            className="w-full px-5 py-2.5 flex items-center gap-3 hover:bg-white/10 text-left transition"
          >
            {it.icon}
            <span className="text-sm font-medium">{it.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
