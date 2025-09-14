// client/src/components/Layout.jsx
import React from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import Topbar from "./Topbar.jsx";
import ChatDock from "./ChatDock.jsx";
import Footer from "./Footer.jsx";

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { pathname } = useLocation();

  // Sidebar sólo en el home
  const showSidebar = pathname === "/";
  // Mostrar botón "Regresar" en cualquier ruta que no sea "/"
  const showBack = pathname !== "/";

  React.useEffect(() => {
    const onKey = (e) => e.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-[100svh] bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
      {/* Fondo global */}
      <div className="app-bg pointer-events-none" aria-hidden />

      {/* Topbar fijo */}
      <header className="sticky top-0 z-40 h-14 bg-white/80 dark:bg-neutral-950/80 backdrop-blur border-b border-neutral-200 dark:border-neutral-800">
        <Topbar onToggleMenu={() => setMobileOpen(true)} showBack={showBack} />
      </header>

      {/* Carril fijo del sidebar (md+) solo en home */}
      {showSidebar && (
        <aside
          role="complementary"
          aria-label="Barra lateral fija"
          className="
            hidden md:block fixed left-0 top-14 bottom-0 w-64 z-40
            bg-white dark:bg-neutral-950 border-r border-white/10
            overflow-hidden
          "
        >
          {/* El Sidebar pinta su contenido; el contenedor le provee fondo y anclaje */}
          <Sidebar />
        </aside>
      )}

      {/* Columna principal (flex para sticky footer) */}
      <div
        className={[
          "relative z-10",
          showSidebar ? "md:pl-64" : "", // evitar que el contenido se meta debajo del sidebar fijo
          "min-h-[calc(100vh-3.5rem)] flex flex-col", // 3.5rem = h-14 del topbar
        ].join(" ")}
      >
        <main id="app-main" className="flex-1">
          <div
            className={`${
              showSidebar ? "max-w-7xl" : "max-w-[1600px]"
            } w-full mx-auto px-4 md:px-6 py-6 space-y-6`}
          >
            {children}
          </div>
        </main>

        {/* Footer en flujo normal (no fijo), sin solaparse con el sidebar */}
        <Footer />
      </div>

      {/* Drawer móvil para el sidebar */}
      <div
        className={`fixed inset-0 z-50 md:hidden transition-opacity ${
          mobileOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!mobileOpen}
      >
        <div
          className="absolute inset-0 bg-black/40"
          onClick={() => setMobileOpen(false)}
        />
        <div
          role="dialog"
          aria-modal="true"
          className={`absolute inset-y-0 left-0 w-72 max-w-[85vw]
            bg-white dark:bg-neutral-950 border-r border-neutral-200 dark:border-neutral-800
            shadow-xl transition-transform duration-300
            ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          <Sidebar variant="mobile" onNavigate={() => setMobileOpen(false)} />
        </div>
      </div>

      {/* Burbuja de chat flotante */}
      <ChatDock />
    </div>
  );
}
