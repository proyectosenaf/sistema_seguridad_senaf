import React from "react";
import { Link } from "react-router-dom";
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
      roles: Array.isArray(raw.roles) && raw.roles.length
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

  /* ───────────── Ping API ───────────── */
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

  /* ───────────── Obtener manuales ───────────── */
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
        window.open(firstAvailableDoc.file.publicUrl, "_blank", "noopener,noreferrer");
        return;
      }

      window.alert(
        "La documentación aún no está disponible. Cuando subas los manuales al backend, aparecerán aquí automáticamente."
      );
    },
    [firstAvailableDoc]
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

      <div className="relative overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-950/70 backdrop-blur p-6 lg:p-8 mx-4 md:mx-6 mb-2">
        <div className="pointer-events-none absolute -z-10 inset-0">
          <div
            className="absolute w-[28rem] h-[28rem] left-[-10%] bottom-[-35%] rounded-full blur-3xl opacity-25"
            style={{
              background:
                "radial-gradient(closest-side, var(--fx1), transparent 70%)",
            }}
          />
          <div
            className="absolute w-[24rem] h-[24rem] right-[-10%] top-[-30%] rounded-full blur-3xl opacity-20"
            style={{
              background:
                "radial-gradient(closest-side, var(--fx2), transparent 70%)",
            }}
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* SENAF */}
          <div>
            <div className="text-2xl font-bold fx-title">SENAF</div>
            <p className="mt-2 text-sm opacity-70">
              Plataforma integral de seguridad: accesos, rondas, incidentes,
              visitas y más.
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs opacity-70">
              <ShieldCheck className="w-4 h-4" /> Datos protegidos · Roles ·
              Auditoría
            </div>
          </div>

          {/* SECCIONES */}
          <div>
            <div className="font-semibold mb-2">Secciones</div>
            <ul className="space-y-1 text-sm">
              {sections.length ? (
                sections.map((s) => (
                  <li key={s.key}>
                    <Link className="hover:underline" to={s.path}>
                      {s.label}
                    </Link>
                  </li>
                ))
              ) : (
                <li className="opacity-70">
                  No hay secciones habilitadas.
                </li>
              )}
            </ul>
          </div>

          {/* SOPORTE */}
          <div>
            <div className="font-semibold mb-2">Soporte</div>

            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 opacity-70" />
                <button
                  type="button"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent("chat:open"))
                  }
                  className="hover:underline text-left"
                >
                  Abrir chat
                </button>
              </li>

              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 opacity-70" />
                <a
                  className="hover:underline break-all"
                  href="mailto:proyectosenaf@gmail.com"
                >
                  proyectosenaf@gmail.com
                </a>
              </li>

              <li className="flex items-center gap-2">
                <FileText className="w-4 h-4 opacity-70" />
                <button
                  type="button"
                  onClick={handleOpenDocumentation}
                  className="hover:underline text-left"
                >
                  Documentación
                </button>
              </li>
            </ul>

            <div className="mt-3 space-y-1 text-sm">
              {docsLoading ? (
                <div className="opacity-60">Cargando manuales...</div>
              ) : docsError ? (
                <div className="opacity-60">
                  No se pudo consultar la documentación.
                </div>
              ) : visibleDocs.length === 0 ? (
                <div className="opacity-60">
                  No hay manuales disponibles para este rol.
                </div>
              ) : (
                visibleDocs.map((doc) => (
                  <div key={doc.slug} className="flex items-start gap-2">
                    <ExternalLink className="w-4 h-4 opacity-70 mt-[2px]" />
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
                        {doc.title} (pendiente)
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ESTADO */}
          <div>
            <div className="font-semibold mb-2">
              Estado del sistema
            </div>
            <div className="text-sm space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block w-2.5 h-2.5 rounded-full ${
                    apiUp === null
                      ? "bg-neutral-400"
                      : apiUp
                      ? "bg-emerald-500"
                      : "bg-rose-500"
                  }`}
                />
                <span className="opacity-80">API</span>
                <span className="opacity-60">·</span>
                <span className="opacity-70 break-all">
                  {apiShown}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 opacity-70" />
                <span className="opacity-80">Ping</span>
                <span className="opacity-60">·</span>
                <span className="opacity-80">
                  {ping != null ? `${ping} ms` : "—"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 opacity-70" />
                <span className="opacity-80">Versión</span>
                <span className="opacity-60">·</span>
                <span className="opacity-80">v{version}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs opacity-70">
          <div>
            © {new Date().getFullYear()} SENAF · Todos los
            derechos reservados
          </div>
          <div className="flex items-center gap-4">
            <a
              className="hover:underline"
              href="#"
              onClick={(e) => e.preventDefault()}
            >
              Privacidad
            </a>
            <a
              className="hover:underline"
              href="#"
              onClick={(e) => e.preventDefault()}
            >
              Términos
            </a>
            <a
              className="inline-flex items-center gap-1 hover:underline"
              href="#"
              onClick={(e) => e.preventDefault()}
            >
              <Github className="w-4 h-4" /> GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}