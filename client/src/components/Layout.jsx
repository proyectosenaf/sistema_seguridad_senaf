// src/components/Layout.jsx
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import Topbar from "./Topbar.jsx";
import ChatDock from "./ChatDock.jsx";
import Footer from "./Footer.jsx";
import { useLayoutUI } from "./layout-ui.jsx";

// 👇 escucha global de alertas
import GlobalPanicListener from "./GlobalPanicListener.jsx";

export default function Layout({ children, hideSidebar: hideSidebarProp = false }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // Contexto global (si existe provider)
  const { hideSidebar: hideSidebarCtx, back } = useLayoutUI();

  // ✅ merge: prop (App.jsx) + ctx (ModuleFullPage)
  const hideSidebar = Boolean(hideSidebarProp || hideSidebarCtx);

  // ✅ Sidebar en TODA la app (solo se oculta si hideSidebar=true)
  const showSidebar = !hideSidebar;

  // Mostrar botón "Regresar" en cualquier ruta que no sea "/"
  const showBack = pathname !== "/" || !!back;

  // Back inteligente: usa custom si existe; si no, evita bucle /login
  const smartBack = React.useCallback(() => {
    if (back?.onClick) {
      back.onClick();
      return;
    }
    const ref = document.referrer || "";
    const cameFromLogin = ref.includes("/login");
    const shallowHistory = window.history.length <= 2;
    if (cameFromLogin || shallowHistory) {
      navigate("/", { replace: true });
    } else {
      navigate(-1);
    }
  }, [back, navigate]);

  // (Opcional) Objeto back, por si tu Topbar lo soporta
  const backProp = React.useMemo(
    () => ({
      label: back?.label || "Regresar",
      onClick: smartBack,
    }),
    [back?.label, smartBack]
  );

  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-[100svh] text-neutral-900 dark:text-neutral-100">
      {/* Esto vive en todo el layout */}
      <GlobalPanicListener />

      {/* Fondo global */}
      <div className="app-bg pointer-events-none" aria-hidden />

      {/* Overlay suave (da profundidad al blur y uniformiza) */}
      <div
        className="pointer-events-none fixed inset-0 z-0
                   bg-white/55 dark:bg-neutral-950/55"
        aria-hidden
      />

      {/* Topbar fijo (glass) */}
      <header
        className="
          sticky top-0 z-40 h-14
          bg-white/70 dark:bg-neutral-950/55
          backdrop-blur-xl
          border-b border-neutral-200/60 dark:border-white/10
        "
      >
        {/* ✅ si tu Topbar no soporta `back`, no rompe. */}
        <Topbar
          onToggleMenu={() => setMobileOpen(true)}
          showBack={showBack}
          back={backProp}
        />
      </header>

      {/* Sidebar fijo (md+) */}
      {showSidebar && (
        <aside
          role="complementary"
          aria-label="Barra lateral fija"
          className="
            hidden md:block fixed left-0 top-14 bottom-0 w-64 z-40
            bg-white/60 dark:bg-neutral-950/50
            backdrop-blur-xl
            border-r border-neutral-200/60 dark:border-white/10
            overflow-hidden
          "
        >
          <Sidebar />
        </aside>
      )}

      {/* Columna principal */}
      <div
        className={[
          "relative z-10",
          showSidebar ? "md:pl-64" : "",
          "min-h-[calc(100vh-3.5rem)] flex flex-col",
        ].join(" ")}
      >
        <main id="app-main" className="flex-1">
          <div
            className={[
              showSidebar ? "max-w-7xl" : "max-w-[1600px]",
              "w-full mx-auto px-4 md:px-6 py-6 space-y-6",
              // ✅ capa estándar para todo el contenido
              "layer-content",
            ].join(" ")}
          >
            {children}
          </div>
        </main>

        <Footer />
      </div>

      {/* Drawer móvil del sidebar */}
      <div
        className={`fixed inset-0 z-50 md:hidden transition-opacity ${
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!mobileOpen}
      >
        <div
          className="absolute inset-0 bg-black/35"
          onClick={() => setMobileOpen(false)}
        />
        <div
          role="dialog"
          aria-modal="true"
          className={`absolute inset-y-0 left-0 w-72 max-w-[85vw]
            bg-white/70 dark:bg-neutral-950/55
            backdrop-blur-xl
            border-r border-neutral-200/60 dark:border-white/10
            shadow-xl transition-transform duration-300
            ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          <Sidebar variant="mobile" onNavigate={() => setMobileOpen(false)} />
        </div>
      </div>

      {/* ✅ Burbuja de chat flotante (SIEMPRE) */}
      <div className="fixed bottom-5 right-5 z-[9999]">
        <ChatDock />
      </div>
    </div>
  );
}
