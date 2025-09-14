// client/src/components/layout-ui.jsx
import React from "react";
import { useNavigate } from "react-router-dom";

const LayoutUIContext = React.createContext(null);

export function LayoutUIProvider({ children }) {
  const [hideSidebar, setHideSidebar] = React.useState(false);
  const [back, setBack] = React.useState(null); // { label, onClick }

  const value = React.useMemo(
    () => ({ hideSidebar, setHideSidebar, back, setBack }),
    [hideSidebar, back]
  );
  return <LayoutUIContext.Provider value={value}>{children}</LayoutUIContext.Provider>;
}

export function useLayoutUI() {
  const ctx = React.useContext(LayoutUIContext);
  if (!ctx) throw new Error("useLayoutUI must be used within LayoutUIProvider");
  return ctx;
}

/**
 * Envuelve el contenido de un módulo para:
 * - Ocultar la barra lateral
 * - Mostrar botón "Regresar" (por defecto va al dashboard '/')
 */
export function ModuleFullPage({ backTo = "/", backLabel = "Regresar", children }) {
  const { setHideSidebar, setBack } = useLayoutUI();
  const nav = useNavigate();

  React.useEffect(() => {
    setHideSidebar(true);
    setBack({ label: backLabel, onClick: () => nav(backTo) });
    return () => {
      setHideSidebar(false);
      setBack(null);
    };
  }, [setHideSidebar, setBack, backLabel, backTo, nav]);

  return <>{children}</>;
}
