import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { getNavSectionsForMe } from "../../config/navConfig.js";
import api, { getToken } from "../../lib/api.js";
import { socket } from "../../lib/socket.js";
import { useAuth } from "../auth/AuthProvider.jsx";

import BitacoraAnalytics from "../Bitacora/components/BitacoraAnalytics.jsx";

import {
  DoorOpen,
  Footprints,
  AlertTriangle,
  Users,
  NotebookPen,
  ShieldCheck,
  Home as HomeIcon,
  Database,
} from "lucide-react";

const ICONS = {
  home: HomeIcon,
  accesos: DoorOpen,
  rondas: Footprints,
  incidentes: AlertTriangle,
  visitas: Users,
  bitacora: NotebookPen,
  iam: ShieldCheck,
  system: Database,
};

const MODULE_ACCENTS = {
  accesos: {
    iconBg: "rgba(59,130,246,0.16)",
    iconColor: "#93c5fd",
    glow: "rgba(59,130,246,0.22)",
    topLine: "linear-gradient(90deg, #60a5fa, #38bdf8)",
  },
  rondas: {
    iconBg: "rgba(34,197,94,0.16)",
    iconColor: "#86efac",
    glow: "rgba(34,197,94,0.20)",
    topLine: "linear-gradient(90deg, #4ade80, #22d3ee)",
  },
  incidentes: {
    iconBg: "rgba(239,68,68,0.16)",
    iconColor: "#fca5a5",
    glow: "rgba(239,68,68,0.18)",
    topLine: "linear-gradient(90deg, #fb7185, #f97316)",
  },
  visitas: {
    iconBg: "rgba(168,85,247,0.16)",
    iconColor: "#d8b4fe",
    glow: "rgba(168,85,247,0.18)",
    topLine: "linear-gradient(90deg, #a78bfa, #22d3ee)",
  },
  bitacora: {
    iconBg: "rgba(6,182,212,0.16)",
    iconColor: "#67e8f9",
    glow: "rgba(6,182,212,0.20)",
    topLine: "linear-gradient(90deg, #38bdf8, #2dd4bf)",
  },
  iam: {
    iconBg: "rgba(234,179,8,0.16)",
    iconColor: "#fde68a",
    glow: "rgba(234,179,8,0.18)",
    topLine: "linear-gradient(90deg, #facc15, #fb7185)",
  },
  system: {
    iconBg: "rgba(148,163,184,0.16)",
    iconColor: "#cbd5e1",
    glow: "rgba(148,163,184,0.18)",
    topLine: "linear-gradient(90deg, #94a3b8, #60a5fa)",
  },
  home: {
    iconBg: "rgba(59,130,246,0.16)",
    iconColor: "#93c5fd",
    glow: "rgba(59,130,246,0.22)",
    topLine: "linear-gradient(90deg, #60a5fa, #38bdf8)",
  },
};

function resolvePrincipal(raw) {
  if (!raw || typeof raw !== "object") return null;

  if (raw.user && typeof raw.user === "object") {
    return {
      ...raw.user,
      ...raw,
      can:
        raw.can && typeof raw.can === "object"
          ? raw.can
          : raw.user.can && typeof raw.user.can === "object"
          ? raw.user.can
          : {},
      superadmin:
        raw.superadmin === true ||
        raw.isSuperAdmin === true ||
        raw.user.superadmin === true ||
        raw.user.isSuperAdmin === true,
      isSuperAdmin:
        raw.isSuperAdmin === true ||
        raw.superadmin === true ||
        raw.user.isSuperAdmin === true ||
        raw.user.superadmin === true,
    };
  }

  return {
    ...raw,
    can: raw.can && typeof raw.can === "object" ? raw.can : {},
    superadmin: raw.superadmin === true || raw.isSuperAdmin === true,
    isSuperAdmin: raw.isSuperAdmin === true || raw.superadmin === true,
  };
}

function SectionCard({ section, onOpen, t }) {
  const key = section.key;
  const Icon = section.icon || ICONS[key] || null;
  const accent = MODULE_ACCENTS[key] || MODULE_ACCENTS.home;
  const label = section.i18nKey ? t(section.i18nKey, { defaultValue: section.label }) : section.label;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative overflow-hidden text-left transition-all duration-200 hover:-translate-y-[2px] active:translate-y-0"
      style={{
        borderRadius: "20px",
        border: "1px solid var(--border)",
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--card-solid) 90%, transparent), color-mix(in srgb, var(--panel) 84%, transparent))",
        color: "var(--text)",
        boxShadow: "var(--shadow-sm)",
        padding: "1.2rem",
      }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px] opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{ background: accent.topLine }}
      />

      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        style={{
          background: `radial-gradient(circle at top left, ${accent.glow} 0%, transparent 45%)`,
        }}
      />

      <div className="relative flex items-center gap-4">
        {Icon && (
          <span
            className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] transition-all duration-200 group-hover:scale-[1.03]"
            style={{
              background: accent.iconBg,
              border: "1px solid var(--border)",
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 0 0 1px transparent`,
            }}
          >
            <Icon
              className="h-6 w-6"
              style={{ color: accent.iconColor }}
              strokeWidth={2.1}
            />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div
            className="truncate text-[1.05rem] font-semibold tracking-[0.01em]"
            style={{ color: "var(--text)" }}
          >
            {label}
          </div>

          <div
            className="mt-1.5 text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            {t("home.goToSection", { section: label })}
          </div>
        </div>
      </div>
    </button>
  );
}

export default function Home() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const auth = useAuth();
  const { user, isLoading } = auth || {};

  const [bitacoraRows, setBitacoraRows] = React.useState([]);

  const principal = React.useMemo(() => {
    return resolvePrincipal(user);
  }, [user]);

  React.useEffect(() => {
    if (!socket) return;

    const onCheck = () => {};

    socket.on("rondasqr:check", onCheck);
    socket.on("rondas:check", onCheck);

    return () => {
      socket.off("rondasqr:check", onCheck);
      socket.off("rondas:check", onCheck);
    };
  }, []);

  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const token = getToken() || "";
        if (!token) return;

        const r = await api.get("/bitacora/v1/events");

        const items = Array.isArray(r?.data?.items)
          ? r.data.items
          : Array.isArray(r?.data)
          ? r.data
          : [];

        if (!alive) return;
        setBitacoraRows(items);
      } catch (err) {
        console.warn("[Home] Error cargando bitácora:", err?.message || err);
        if (!alive) return;
        setBitacoraRows([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const SECTIONS = React.useMemo(() => {
    const secs = getNavSectionsForMe(principal) || [];

    const order = [
      "accesos",
      "rondas",
      "iam",
      "incidentes",
      "visitas",
      "bitacora",
      "system",
    ];

    const rank = (k) => {
      const i = order.indexOf(k);
      return i === -1 ? 999 : i;
    };

    return [...secs].sort((a, b) => rank(a.key) - rank(b.key));
  }, [principal]);

  if (isLoading) {
    return (
      <div className="p-6" style={{ color: "var(--text-muted)" }}>
        {t("system.loading")}
      </div>
    );
  }

  if (!principal) {
    return (
      <div className="p-6" style={{ color: "var(--text-muted)" }}>
        {t("system.loadingSession")}
      </div>
    );
  }

  return (
    <div className="layer-content space-y-6">
      <div className="mod-card">
        <div className="mod-card__head">
          <div>
            <h2 className="mod-card__title">{t("home.sectionsTitle")}</h2>
            <p className="mod-card__sub">{t("home.sectionsSubtitle")}</p>
          </div>
        </div>

        <div className="mod-table-wrap pt-4">
          {SECTIONS.length === 0 ? (
            <div
              className="rounded-[16px] p-4 text-sm"
              style={{
                background: "color-mix(in srgb, var(--panel) 72%, transparent)",
                border: "1px solid var(--border)",
                color: "var(--text-muted)",
              }}
            >
              {t("home.noSections")}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {SECTIONS.map((s) => (
                <SectionCard
                  key={s.key}
                  section={s}
                  onOpen={() => nav(s.path)}
                  t={t}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mod-card">
        <div className="mod-card__head">
          <div>
            <h2 className="mod-card__title">{t("home.analyticsTitle")}</h2>
            <p className="mod-card__sub">{t("home.analyticsSubtitle")}</p>
          </div>
        </div>

        <div className="pt-4">
          <BitacoraAnalytics rows={bitacoraRows} />
        </div>
      </div>
    </div>
  );
}