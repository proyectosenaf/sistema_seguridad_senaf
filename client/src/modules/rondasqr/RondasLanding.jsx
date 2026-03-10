// client/src/modules/rondasqr/RondasLanding.jsx
import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Footprints, BarChart3, Settings2 } from "lucide-react";

const fxCard =
  "rounded-3xl border border-neutral-200/60 dark:border-white/10 " +
  "bg-white/55 dark:bg-neutral-950/35 backdrop-blur-2xl shadow-sm";

function Tile({ title, subtitle, Icon, onClick }) {
  return (
    <button onClick={onClick} className="fx-tile text-left p-4" type="button">
      <div className="flex items-center gap-3">
        {Icon ? <Icon className="w-5 h-5 opacity-80" /> : null}
        <div className="font-medium">{title}</div>
      </div>
      {subtitle ? <div className="text-xs mt-1 opacity-70">{subtitle}</div> : null}
    </button>
  );
}

function resolvePrincipal(me) {
  if (!me || typeof me !== "object") return null;

  if (me.user && typeof me.user === "object") {
    return {
      ...me.user,
      can:
        me?.can && typeof me.can === "object"
          ? me.can
          : me?.user?.can && typeof me.user.can === "object"
          ? me.user.can
          : {},
      superadmin:
        me?.superadmin === true ||
        me?.isSuperAdmin === true ||
        me?.user?.superadmin === true ||
        me?.user?.isSuperAdmin === true,
    };
  }

  return {
    ...me,
    can: me?.can && typeof me.can === "object" ? me.can : {},
    superadmin: me?.superadmin === true || me?.isSuperAdmin === true,
  };
}

export default function RondasLanding({ me }) {
  const nav = useNavigate();

  const principal = resolvePrincipal(me);
  const can = principal?.can || {};
  const isSuperadmin = principal?.superadmin === true;

  // ✅ Fuente única: backend (/api/iam/v1/me)
  // superadmin backend ve todo el módulo
  const allowScan = isSuperadmin || can["rondasqr.scan"] === true;
  const allowReports = isSuperadmin || can["rondasqr.reports"] === true;
  const allowAdmin = isSuperadmin || can["rondasqr.admin"] === true;

  const tiles = useMemo(() => {
    const list = [];

    if (allowScan) {
      list.push({
        key: "scan",
        title: "Registrador Punto Control",
        subtitle: "Escanea puntos asignados y envía alertas.",
        Icon: Footprints,
        go: "/rondasqr/scan",
      });
    }

    if (allowReports) {
      list.push({
        key: "reports",
        title: "Reportes",
        subtitle: "Dashboard y reportes de rondas.",
        Icon: BarChart3,
        go: "/rondasqr/reports",
      });
    }

    if (allowAdmin) {
      list.push({
        key: "admin",
        title: "Administración",
        subtitle: "Ciudades, rondas, puntos, planes y asignaciones.",
        Icon: Settings2,
        go: "/rondasqr/admin",
      });
    }

    return list;
  }, [allowScan, allowReports, allowAdmin]);

  return (
    <div className="space-y-6 layer-content">
      <div className={fxCard + " p-5"}>
        <h2 className="text-2xl font-extrabold tracking-tight">Rondas de Vigilancia</h2>
        <p className="text-sm mt-1 text-neutral-600 dark:text-white/70">
          Accesos según tu perfil.
        </p>
      </div>

      <div className={fxCard + " p-5"}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((t) => (
            <Tile
              key={t.key}
              title={t.title}
              subtitle={t.subtitle}
              Icon={t.Icon}
              onClick={() => nav(t.go)}
            />
          ))}

          {!tiles.length ? (
            <div className="text-sm text-neutral-600 dark:text-white/70">
              No tienes permisos para ver secciones de rondas.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}