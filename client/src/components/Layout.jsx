// src/components/Layout.jsx
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import Topbar from "./Topbar.jsx";
import ChatDock from "./ChatDock.jsx";
import Footer from "./Footer.jsx";
import { useLayoutUI } from "./layout-ui.jsx";
import GlobalPanicListener from "./GlobalPanicListener.jsx";

/**
 * Layout modes (parametrizable):
 * - "app": normal (sidebar + footer + chat)
 * - "full": sin sidebar (ej: pantallas tipo módulo full)
 * - "visitor": experiencia “kiosk” (sin sidebar, sin footer, sin chat; topbar opcional)
 */
const DEFAULT_LOGIN_PATH = String(import.meta.env.VITE_ROUTE_LOGIN || "/login");

function parseBool(v, def = false) {
  if (v === undefined || v === null) return def;
  const s = String(v).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(s)) return true;
  if (["0", "false", "no", "n", "off"].includes(s)) return false;
  return def;
}

export default function Layout({
  children,

  // compat anterior
  hideSidebar: hideSidebarProp = false,

  // ✅ modo
  layoutMode = "app", // "app" | "full" | "visitor"

  // ✅ overrides opcionales
  hideTopbar: hideTopbarProp,
  hideFooter: hideFooterProp,
  hideChatDock: hideChatDockProp,
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const {
    hideSidebar: hideSidebarCtx,
    hideFooter: hideFooterCtx,
    hideTopbar: hideTopbarCtx,
    hideChatDock: hideChatDockCtx,
    back,
  } = useLayoutUI();

  // ENV opcional (parametrizado)
  const ENV_HIDE_CHAT_FOR_VISITOR = parseBool(import.meta.env.VITE_HIDE_CHAT_FOR_VISITOR, true);
  const ENV_HIDE_TOPBAR_FOR_VISITOR = parseBool(import.meta.env.VITE_HIDE_TOPBAR_FOR_VISITOR, false);
  const ENV_HIDE_FOOTER_FOR_VISITOR = parseBool(import.meta.env.VITE_HIDE_FOOTER_FOR_VISITOR, true);

  // ✅ Reglas por modo (sin hardcode de rutas)
  const modeHideSidebar = layoutMode === "full" || layoutMode === "visitor";
  const modeHideFooter = layoutMode === "visitor" ? ENV_HIDE_FOOTER_FOR_VISITOR : false;
  const modeHideChatDock = layoutMode === "visitor" ? ENV_HIDE_CHAT_FOR_VISITOR : false;
  const modeHideTopbar = layoutMode === "visitor" ? ENV_HIDE_TOPBAR_FOR_VISITOR : false;

  // ✅ merge final (prop > ctx > modo)
  const hideSidebar = Boolean(
    hideSidebarProp || hideSidebarCtx || modeHideSidebar
  );

  const hideFooter =
    hideFooterProp !== undefined
      ? Boolean(hideFooterProp)
      : hideFooterCtx !== undefined
      ? Boolean(hideFooterCtx)
      : Boolean(modeHideFooter);

  const hideChatDock =
    hideChatDockProp !== undefined
      ? Boolean(hideChatDockProp)
      : hideChatDockCtx !== undefined
      ? Boolean(hideChatDockCtx)
      : Boolean(modeHideChatDock);

  const hideTopbar =
    hideTopbarProp !== undefined
      ? Boolean(hideTopbarProp)
      : hideTopbarCtx !== undefined
      ? Boolean(hideTopbarCtx)
      : Boolean(modeHideTopbar);

  const showSidebar = !hideSidebar;

  // ✅ back sólo si hay Topbar
  const showBack = !hideTopbar && (pathname !== "/" || !!back?.onClick);

  const smartBack = React.useCallback(() => {
    if (back?.onClick) {
      back.onClick();
      return;
    }
    const ref = document.referrer || "";
    const cameFromLogin = ref.includes(DEFAULT_LOGIN_PATH);
    const shallowHistory = window.history.length <= 2;

    if (cameFromLogin || shallowHistory) navigate("/", { replace: true });
    else navigate(-1);
  }, [back, navigate]);

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

  // Si el sidebar está oculto, cerrar drawer móvil
  React.useEffect(() => {
    if (!showSidebar && mobileOpen) setMobileOpen(false);
  }, [showSidebar, mobileOpen]);

  return (
    <div className="min-h-[100svh] text-neutral-900 dark:text-neutral-100">
      <GlobalPanicListener />

      <div className="app-bg pointer-events-none" aria-hidden />
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-white/55 dark:bg-neutral-950/55"
        aria-hidden
      />

      {!hideTopbar && (
        <header
          className="
            sticky top-0 z-40 h-14
            bg-white/70 dark:bg-neutral-950/55
            backdrop-blur-xl
            border-b border-neutral-200/60 dark:border-white/10
          "
        >
          <Topbar
            onToggleMenu={() => setMobileOpen(true)}
            showBack={showBack}
            back={backProp}
          />
        </header>
      )}

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
              "layer-content",
            ].join(" ")}
          >
            {children}
          </div>
        </main>

        {!hideFooter && <Footer />}
      </div>

      {/* Drawer móvil (solo si sidebar visible) */}
      {showSidebar && (
        <div
          className={`fixed inset-0 z-50 md:hidden transition-opacity ${
            mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
          aria-hidden={!mobileOpen}
        >
          <div className="absolute inset-0 bg-black/35" onClick={() => setMobileOpen(false)} />
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
      )}

      {/* Chat flotante */}
      {!hideChatDock && (
        <div className="fixed bottom-5 right-5 z-[9999]">
          <ChatDock />
        </div>
      )}
    </div>
  );
}