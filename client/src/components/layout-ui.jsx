// src/components/layout-ui.jsx
import React from "react";
import { useNavigate } from "react-router-dom";

const LayoutUIContext = React.createContext(null);

export function LayoutUIProvider({ children }) {
  const [hideSidebar, setHideSidebar] = React.useState(false);

  // ✅ Antes Layout.jsx estaba leyendo estos del ctx, pero aquí no existían
  const [hideTopbar, setHideTopbar] = React.useState(false);
  const [hideFooter, setHideFooter] = React.useState(false);
  const [hideChatDock, setHideChatDock] = React.useState(false);

  const [back, setBack] = React.useState(null); // { label, onClick }

  const value = React.useMemo(
    () => ({
      hideSidebar,
      setHideSidebar,

      hideTopbar,
      setHideTopbar,

      hideFooter,
      setHideFooter,

      hideChatDock,
      setHideChatDock,

      back,
      setBack,
    }),
    [hideSidebar, hideTopbar, hideFooter, hideChatDock, back]
  );

  return <LayoutUIContext.Provider value={value}>{children}</LayoutUIContext.Provider>;
}

// ✅ Seguro: si no hay provider, devuelve defaults
export function useLayoutUI() {
  const ctx = React.useContext(LayoutUIContext);
  if (ctx) return ctx;
  return {
    hideSidebar: false,
    setHideSidebar: () => {},

    hideTopbar: false,
    setHideTopbar: () => {},

    hideFooter: false,
    setHideFooter: () => {},

    hideChatDock: false,
    setHideChatDock: () => {},

    back: null,
    setBack: () => {},
  };
}

/**
 * Envuelve el contenido de un módulo para:
 * - Ocultar la barra lateral
 * - Mostrar botón "Regresar" con destino configurable
 */
export function ModuleFullPage({ backTo = "/", backLabel = "Regresar", replace = false, children }) {
  const { setHideSidebar, setBack } = useLayoutUI();
  const nav = useNavigate();

  React.useEffect(() => {
    setHideSidebar(true);
    setBack({ label: backLabel, onClick: () => nav(backTo, { replace }) });

    return () => {
      setHideSidebar(false);
      setBack(null);
    };
  }, [setHideSidebar, setBack, backLabel, backTo, nav, replace]);

  return <>{children}</>;
}

/**
 * ✅ Opcional: Modo visitante tipo "kiosk"
 * - es útil si alguna pantalla quiere forzar visitor layout sin depender de AppShell
 */
export function VisitorFullPage({ children }) {
  const {
    setHideSidebar,
    setHideTopbar,
    setHideFooter,
    setHideChatDock,
    setBack,
  } = useLayoutUI();

  React.useEffect(() => {
    setHideSidebar(true);
    setHideTopbar(true);
    setHideFooter(true);
    setHideChatDock(true);
    setBack(null);

    return () => {
      setHideSidebar(false);
      setHideTopbar(false);
      setHideFooter(false);
      setHideChatDock(false);
      setBack(null);
    };
  }, [setHideSidebar, setHideTopbar, setHideFooter, setHideChatDock, setBack]);

  return <>{children}</>;
}