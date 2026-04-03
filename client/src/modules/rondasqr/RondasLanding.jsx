// client/src/modules/rondasqr/RondasLanding.jsx
import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
      {subtitle ? (
        <div className="text-xs mt-1 opacity-70">{subtitle}</div>
      ) : null}
    </button>
  );
}

function normalizeArray(v) {
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return [];
}

function uniqLower(arr) {
  return Array.from(
    new Set(
      normalizeArray(arr)
        .map((x) => String(x).trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function resolvePrincipal(me) {
  if (!me || typeof me !== "object") return null;

  if (me.user && typeof me.user === "object") {
    const merged = {
      ...me.user,
      ...me,
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
      isSuperAdmin:
        me?.isSuperAdmin === true ||
        me?.superadmin === true ||
        me?.user?.isSuperAdmin === true ||
        me?.user?.superadmin === true,
    };

    const perms = uniqLower(merged?.perms || merged?.permissions || []);
    return {
      ...merged,
      perms,
      permissions: perms,
    };
  }

  const perms = uniqLower(me?.perms || me?.permissions || []);

  return {
    ...me,
    can: me?.can && typeof me.can === "object" ? me.can : {},
    superadmin: me?.superadmin === true || me?.isSuperAdmin === true,
    isSuperAdmin: me?.isSuperAdmin === true || me?.superadmin === true,
    perms,
    permissions: perms,
  };
}

function hasPermLike(principal, key) {
  const wanted = String(key || "").trim().toLowerCase();
  if (!wanted) return false;

  const perms = uniqLower(principal?.perms || principal?.permissions || []);
  return perms.includes("*") || perms.includes(wanted);
}

export default function RondasLanding({ me }) {
  const nav = useNavigate();
  const { t } = useTranslation();

  const principal = resolvePrincipal(me);
  const can = principal?.can || {};
  const isSuperadmin =
    principal?.superadmin === true || principal?.isSuperAdmin === true;

  const allowModule =
    isSuperadmin ||
    can["nav.rondas"] === true ||
    can["rondas.panel"] === true ||
    can["rondasqr.scan"] === true ||
    can["rondasqr.reports"] === true ||
    can["rondasqr.admin"] === true ||
    hasPermLike(principal, "rondasqr.scan.execute") ||
    hasPermLike(principal, "rondasqr.scan.manual") ||
    hasPermLike(principal, "rondasqr.checks.write") ||
    hasPermLike(principal, "rondasqr.reports.read") ||
    hasPermLike(principal, "rondasqr.assignments.read") ||
    hasPermLike(principal, "rondasqr.rounds.read");

  const allowScan =
    isSuperadmin ||
    can["rondasqr.scan"] === true ||
    can["rondas.panel"] === true ||
    hasPermLike(principal, "rondasqr.scan.execute") ||
    hasPermLike(principal, "rondasqr.scan.manual") ||
    hasPermLike(principal, "rondasqr.checks.write");

  const allowReports =
    isSuperadmin ||
    can["rondasqr.reports"] === true ||
    hasPermLike(principal, "rondasqr.reports.read") ||
    hasPermLike(principal, "rondasqr.reports.query") ||
    hasPermLike(principal, "rondasqr.reports.export") ||
    hasPermLike(principal, "rondasqr.reports.print") ||
    hasPermLike(principal, "rondasqr.reports.map") ||
    hasPermLike(principal, "rondasqr.reports.highlight");

  const allowAdmin =
    isSuperadmin ||
    can["rondasqr.admin"] === true ||
    hasPermLike(principal, "rondasqr.assignments.read") ||
    hasPermLike(principal, "rondasqr.assignments.write") ||
    hasPermLike(principal, "rondasqr.rounds.read") ||
    hasPermLike(principal, "rondasqr.rounds.write") ||
    hasPermLike(principal, "rondasqr.checkpoints.read") ||
    hasPermLike(principal, "rondasqr.checkpoints.write") ||
    hasPermLike(principal, "rondasqr.sites.read") ||
    hasPermLike(principal, "rondasqr.sites.write") ||
    hasPermLike(principal, "rondasqr.qr.read") ||
    hasPermLike(principal, "rondasqr.qr.generate") ||
    hasPermLike(principal, "rondasqr.qr.export");

  const tiles = useMemo(() => {
    const list = [];

    if (allowScan) {
      list.push({
        key: "scan",
        title: t("rondas.checkpointScanner"),
        subtitle: t("rondas.checkpointScannerDesc"),
        Icon: Footprints,
        go: "/rondasqr/scan",
      });
    }

    if (allowReports) {
      list.push({
        key: "reports",
        title: t("rondas.reports"),
        subtitle: t("rondas.reportsDesc"),
        Icon: BarChart3,
        go: "/rondasqr/reports",
      });
    }

    if (allowAdmin) {
      list.push({
        key: "admin",
        title: t("rondas.admin"),
        subtitle: t("rondas.adminDesc"),
        Icon: Settings2,
        go: "/rondasqr/admin",
      });
    }

    return list;
  }, [allowScan, allowReports, allowAdmin, t]);

  if (!allowModule) {
    return (
      <div className="space-y-6 layer-content">
        <div className={fxCard + " p-5"}>
          <h2 className="text-2xl font-extrabold tracking-tight">
            {t("rondas.title")}
          </h2>
          <p className="text-sm mt-1 text-neutral-600 dark:text-white/70">
            {t("rondas.noAccess")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 layer-content">
      <div className={fxCard + " p-5"}>
        <h2 className="text-2xl font-extrabold tracking-tight">
          {t("rondas.title")}
        </h2>
        <p className="text-sm mt-1 text-neutral-600 dark:text-white/70">
          {t("rondas.subtitle")}
        </p>
      </div>

      <div className={fxCard + " p-5"}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((tItem) => (
            <Tile
              key={tItem.key}
              title={tItem.title}
              subtitle={tItem.subtitle}
              Icon={tItem.Icon}
              onClick={() => nav(tItem.go)}
            />
          ))}

          {!tiles.length ? (
            <div className="text-sm text-neutral-600 dark:text-white/70">
              {t("rondas.noSections")}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}