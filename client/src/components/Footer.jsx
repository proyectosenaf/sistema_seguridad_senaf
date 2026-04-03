import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../lib/api.js";
import { useAuth } from "../pages/auth/AuthProvider.jsx";
import { getNavSectionsForMe } from "../config/navConfig.js";
import {
  MessageCircle,
  Mail,
  ExternalLink,
  ShieldCheck,
  Server,
  Clock,
  Github,
  FileText,
} from "lucide-react";

/* ───────────────────── Helpers usuario ───────────────────── */

function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function resolvePrincipal(auth) {
  const raw = auth?.me || auth?.user || null;
  if (!raw || typeof raw !== "object") return null;

  const email =
    normalizeEmail(raw.email) ||
    normalizeEmail(raw.user?.email) ||
    normalizeEmail(raw.profile?.email) ||
    "";

  if (email === "proyectosenaf@gmail.com") {
    return {
      ...raw,
      email,
      superadmin: true,
      isSuperAdmin: true,
      roles:
        Array.isArray(raw.roles) && raw.roles.length
          ? raw.roles
          : ["superadmin", "admin"],
      can:
        raw.can && typeof raw.can === "object"
          ? raw.can
          : {
              "nav.accesos": true,
              "nav.rondas": true,
              "nav.incidentes": true,
              "nav.visitas": true,
              "nav.bitacora": true,
              "nav.iam": true,
            },
    };
  }

  return raw;
}

function getUserRole(principal) {
  if (!principal) return "visitor";

  const roles = principal?.roles || principal?.role || [];
  const arr = Array.isArray(roles) ? roles : [roles];
  const clean = arr.map((r) => String(r || "").trim().toLowerCase());

  if (clean.includes("superadmin") || clean.includes("admin")) {
    return "admin";
  }

  if (
    clean.includes("visitante") ||
    clean.includes("visita") ||
    clean.includes("visitor")
  ) {
    return "visitor";
  }

  return "roles";
}

function sortDocs(list = []) {
  const order = {
    "manual-admin": 1,
    "manual-roles": 2,
    "manual-visitante": 3,
  };

  return [...list].sort((a, b) => {
    const ao = order[a?.slug] || 999;
    const bo = order[b?.slug] || 999;
    return ao - bo;
  });
}

/* ───────────────────── Componente ───────────────────── */

export default function Footer() {
  const { t } = useTranslation();
  const auth = useAuth();
  const principal = React.useMemo(() => resolvePrincipal(auth), [auth]);
  const userRole = React.useMemo(() => getUserRole(principal), [principal]);

  const [apiUp, setApiUp] = React.useState(null);
  const [ping, setPing] = React.useState(null);
  const [docs, setDocs] = React.useState([]);
  const [docsLoading, setDocsLoading] = React.useState(true);
  const [docsError, setDocsError] = React.useState(false);

  const version = import.meta.env.VITE_APP_VERSION || "1.0.0";

  const apiBaseUrl = String(
    api?.defaults?.baseURL || "http://localhost:4000/api"
  ).replace(/\/$/, "");

  const apiShown = apiBaseUrl;

  const sections = React.useMemo(() => {
    const secs = getNavSectionsForMe(principal) || [];
    const order = [
      "accesos",
      "rondas",
      "incidentes",
      "visitas",
      "bitacora",
      "iam",
    ];
    const rank = (k) => {
      const i = order.indexOf(k);
      return i === -1 ? 999 : i;
    };
    return [...secs].sort((a, b) => rank(a.key) - rank(b.key));
  }, [principal]);

  const visibleDocs = React.useMemo(() => {
    let filtered = Array.isArray(docs) ? docs : [];

    if (userRole === "visitor") {
      filtered = filtered.filter((d) => d.audience === "visitor");
    } else if (userRole === "admin") {
      filtered = filtered.filter(
        (d) => d.audience === "admin" || d.audience === "roles"
      );
    } else {
      filtered = filtered.filter((d) => d.audience === "roles");
    }

    return sortDocs(filtered);
  }, [docs, userRole]);

  const firstAvailableDoc = React.useMemo(() => {
    return visibleDocs.find((d) => d?.file?.publicUrl) || null;
  }, [visibleDocs]);

  React.useEffect(() => {
    let cancel = false;

    const pingApi = async () => {
      try {
        const t0 = performance.now();
        const r = await api.get("/health", { timeout: 5000 });
        const t1 = performance.now();

        if (cancel) return;

        setPing(Math.round(t1 - t0));
        setApiUp(r?.data?.ok === true);
      } catch {
        if (!cancel) {
          setApiUp(false);
          setPing(null);
        }
      }
    };

    pingApi();
    const id = setInterval(pingApi, 30000);

    return () => {
      cancel = true;
      clearInterval(id);
    };
  }, []);

  React.useEffect(() => {
    let mounted = true;

    const loadDocs = async () => {
      setDocsLoading(true);
      setDocsError(false);

      try {
        const { data } = await api.get("/support/docs");
        if (!mounted) return;

        const list = Array.isArray(data?.docs) ? data.docs : [];
        setDocs(list);
      } catch (e) {
        if (!mounted) return;
        setDocs([]);
        setDocsError(true);
        console.warn("[Footer] No se pudieron cargar los manuales:", e);
      } finally {
        if (mounted) setDocsLoading(false);
      }
    };

    loadDocs();

    return () => {
      mounted = false;
    };
  }, []);

  const handleOpenDocumentation = React.useCallback(
    (e) => {
      e.preventDefault();

      if (firstAvailableDoc?.file?.publicUrl) {
        window.open(
          firstAvailableDoc.file.publicUrl,
          "_blank",
          "noopener,noreferrer"
        );
        return;
      }

      window.alert(t("footer.docsNotAvailable"));
    },
    [firstAvailableDoc, t]
  );

  return (
    <footer className="mt-10">
      <div
        className="h-[2px] mx-4 md:mx-6 opacity-80"
        style={{
          background:
            "linear-gradient(90deg, var(--fx1), var(--fx2), var(--fx3))",
        }}
        aria-hidden
      />

      <div className="relative mx-4 mb-2 overflow-hidden rounded-2xl border border-neutral-200 bg-white/80 p-6 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/70 md:mx-6 lg:p-8">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div
            className="absolute bottom-[-35%] left-[-10%] h-[28rem] w-[28rem] rounded-full blur-3xl opacity-25"
            style={{
              background:
                "radial-gradient(closest-side, var(--fx1), transparent 70%)",
            }}
          />
          <div
            className="absolute right-[-10%] top-[-30%] h-[24rem] w-[24rem] rounded-full blur-3xl opacity-20"
            style={{
              background:
                "radial-gradient(closest-side, var(--fx2), transparent 70%)",
            }}
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="fx-title text-2xl font-bold">SENAF</div>
            <p className="mt-2 text-sm opacity-70">
              {t("footer.description")}
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs opacity-70">
              <ShieldCheck className="h-4 w-4" />
              {t("footer.protectedData")}
            </div>
          </div>

          <div>
            <div className="mb-2 font-semibold">{t("footer.sections")}</div>
            <ul className="space-y-1 text-sm">
              {sections.length ? (
                sections.map((s) => (
                  <li key={s.key}>
                    <Link className="hover:underline" to={s.path}>
                      {s.i18nKey ? t(s.i18nKey) : s.label}
                    </Link>
                  </li>
                ))
              ) : (
                <li className="opacity-70">{t("footer.noSections")}</li>
              )}
            </ul>
          </div>

          <div>
            <div className="mb-2 font-semibold">{t("footer.support")}</div>

            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 opacity-70" />
                <button
                  type="button"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent("chat:open"))
                  }
                  className="text-left hover:underline"
                >
                  {t("footer.openChat")}
                </button>
              </li>

              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 opacity-70" />
                <a
                  className="break-all hover:underline"
                  href="mailto:proyectosenaf@gmail.com"
                >
                  proyectosenaf@gmail.com
                </a>
              </li>

              <li className="flex items-center gap-2">
                <FileText className="h-4 w-4 opacity-70" />
                <button
                  type="button"
                  onClick={handleOpenDocumentation}
                  className="text-left hover:underline"
                >
                  {t("footer.helpCenter")}
                </button>
              </li>
            </ul>

            <div className="mt-3 space-y-1 text-sm">
              {docsLoading ? (
                <div className="opacity-60">{t("footer.loadingManuals")}</div>
              ) : docsError ? (
                <div className="opacity-60">{t("footer.docsQueryError")}</div>
              ) : visibleDocs.length === 0 ? (
                <div className="opacity-60">{t("footer.noManualsForRole")}</div>
              ) : (
                visibleDocs.map((doc) => (
                  <div key={doc.slug} className="flex items-start gap-2">
                    <ExternalLink className="mt-[2px] h-4 w-4 opacity-70" />
                    {doc.file?.publicUrl ? (
                      <a
                        className="hover:underline"
                        href={doc.file.publicUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {doc.title}
                      </a>
                    ) : (
                      <span className="opacity-60">
                        {doc.title} ({t("footer.pending")})
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <div className="mb-2 font-semibold">{t("footer.systemStatus")}</div>
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${
                    apiUp === null
                      ? "bg-neutral-400"
                      : apiUp
                      ? "bg-emerald-500"
                      : "bg-rose-500"
                  }`}
                />
                <span className="opacity-80">API</span>
                <span className="opacity-60">·</span>
                <span className="break-all opacity-70">{apiShown}</span>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 opacity-70" />
                <span className="opacity-80">{t("footer.pingLabel")}</span>
                <span className="opacity-60">·</span>
                <span className="opacity-80">
                  {ping != null ? `${ping} ms` : "—"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 opacity-70" />
                <span className="opacity-80">{t("footer.versionLabel")}</span>
                <span className="opacity-60">·</span>
                <span className="opacity-80">v{version}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center justify-between gap-3 border-t border-neutral-200 pt-6 text-xs opacity-70 dark:border-neutral-800 sm:flex-row">
          <div>
            © {new Date().getFullYear()} SENAF · {t("footer.copyright")}
          </div>
          <div className="flex items-center gap-4">
            <a
              className="hover:underline"
              href="#"
              onClick={(e) => e.preventDefault()}
            >
              {t("footer.privacy")}
            </a>
            <a
              className="hover:underline"
              href="#"
              onClick={(e) => e.preventDefault()}
            >
              {t("footer.terms")}
            </a>
            <a
              className="inline-flex items-center gap-1 hover:underline"
              href="#"
              onClick={(e) => e.preventDefault()}
            >
              <Github className="h-4 w-4" />
              GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}