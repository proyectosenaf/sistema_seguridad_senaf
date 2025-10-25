import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Home, AlertTriangle, QrCode, MessageSquare, Layers,
  Upload, Pencil, FileBarChart, Camera, Send, Database,
  Settings, LogOut, BookOpen, Info, Languages
} from "lucide-react";
import { rondasqrApi } from "../api/rondasqrApi";

/** Sidebar Guardia — look&feel alineado con el Sidebar principal */
export default function SidebarGuard({ onSelect }) {
  const navigate = useNavigate();

  const defaultAction = async (key) => {
    try {
      switch (key) {
        case "alert": {
          let gps;
          if ("geolocation" in navigator) {
            await new Promise((resolve) => {
              navigator.geolocation.getCurrentPosition(
                (pos) => { gps = { lat: pos.coords.latitude, lon: pos.coords.longitude }; resolve(); },
                () => resolve(),
                { enableHighAccuracy: true, timeout: 5000 }
              );
            });
          }
          await rondasqrApi.panic(gps);
          window.alert("🚨 Alerta de pánico enviada.");
          break;
        }
        case "msg":    navigate("/incidentes/nuevo"); break;
        case "photo":  window.alert("📷 Enviar foto: pendiente."); break;
        case "tx":     window.alert("⬆️ Transmitir Rondas: pendiente."); break;
        case "dumpdb": window.alert("💾 Enviar base de datos: pendiente."); break;
        case "config": window.alert("⚙️ Configurar: pendiente."); break;
        case "manuals":window.open("https://example.com/manual.pdf","_blank","noopener,noreferrer"); break;
        case "about":  window.alert("ℹ️ SENAF · Módulo Rondas QR"); break;
        case "lang":   window.alert("🌐 Cambio de idioma: pendiente."); break;
        case "logout": navigate("/login"); break;
        default: break;
      }
    } catch (err) {
      console.error("[Sidebar defaultAction]", err);
      window.alert("Ocurrió un error ejecutando la acción.");
    }
  };

  const emit = (key) => (onSelect ? onSelect(key) : defaultAction(key));

  // ✅ “Hogar” → panel unificado (/rondasqr/scan) con 'end' para no solapar activos
  // ✅ “Registrador Punto Control” → subruta específica (/rondasqr/scan/qr)
  // ✅ “Informes” → /rondasqr/reports (no /rondasqr/panel)
  // (Ajusta las rutas Admin si tus páginas viven en otro path)
  const navItems = [
    { key: "home",    label: "Hogar",                     icon: <Home size={18} />,        to: "/rondasqr/scan",            end: true },
    { key: "scan",    label: "Registrador Punto Control", icon: <QrCode size={18} />,      to: "/rondasqr/scan/qr" },
    { key: "reports", label: "Informes",                  icon: <FileBarChart size={18} />,to: "/rondasqr/reports" },
    { key: "create",  label: "Crear rondas",              icon: <Layers size={18} />,      to: "/rondasqr/admin/checkpoints" },
    { key: "load",    label: "Cargar rondas",             icon: <Upload size={18} />,      to: "/rondasqr/admin/plans" },
    { key: "edit",    label: "Editar Rondas",             icon: <Pencil size={18} />,      to: "/rondasqr/admin/plans" },
    { key: "inicio",  label: "Inicio",                    icon: <Home size={18} />,        to: "/start" },
  ];

  const actionItems = [
    { key: "alert",   label: "Enviar Alerta",        icon: <AlertTriangle size={18} /> },
    { key: "msg",     label: "Mensaje Incidente",    icon: <MessageSquare size={18} /> },
    { key: "photo",   label: "Enviar foto",          icon: <Camera size={18} /> },
    { key: "tx",      label: "Transmitir Rondas",    icon: <Send size={18} /> },
    { key: "dumpdb",  label: "Enviar base de datos", icon: <Database size={18} /> },
    { key: "config",  label: "Configurar",           icon: <Settings size={18} /> },
    { key: "manuals", label: "Manuales",             icon: <BookOpen size={18} /> },
    { key: "about",   label: "Acerca",               icon: <Info size={18} /> },
    { key: "lang",    label: "Idioma",               icon: <Languages size={18} /> },
    { key: "logout",  label: "Salir App",            icon: <LogOut size={18} /> },
  ];

  // Clases (alineadas al sidebar principal)
  const itemBase   = "group relative block rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]";
  const itemHover  = "hover:bg-white/10";
  const itemActive = "bg-white/14 ring-1 ring-white/20";

  return (
    <aside
      className={[
        "w-64 h-full flex flex-col overflow-y-auto overscroll-contain",
        "border-r border-white/10 p-4 sidebar-aurora text-white"
      ].join(" ")}
      aria-label="Barra lateral (Guardia)"
    >
      <div className="text-2xl font-extrabold mb-6 tracking-tight">CENTRO</div>
      <div className="text-xs opacity-80 -mt-5 mb-5">Visión del Guardia</div>

      <nav className="flex-1 flex flex-col gap-1">
        {navItems.map((it) => (
          <NavLink
            key={it.key}
            to={it.to}
            end={it.end}
            className={({ isActive }) => [itemBase, isActive ? itemActive : itemHover].join(" ")}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              {it.icon}
              <span className="text-[15px] leading-none text-white">{it.label}</span>
            </div>
          </NavLink>
        ))}

        {actionItems.map((it) => (
          <button
            key={it.key}
            onClick={() => emit(it.key)}
            className={[itemBase, itemHover, "text-left"].join(" ")}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              {it.icon}
              <span className="text-[15px] leading-none text-white">{it.label}</span>
            </div>
          </button>
        ))}
      </nav>
    </aside>
  );
}
