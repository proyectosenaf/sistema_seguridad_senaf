// client/src/iam/pages/IamAdmin/UsersPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { iamApi } from "../../api/iamApi.js";
import { Edit3, Trash2 } from "lucide-react";

// ✅ Token canónico central (senaf_token -> token)
import { getToken as getTokenCanonical } from "../../../lib/api.js";

// mismo flag que en iamApi.js, pero del lado del cliente
const DISABLE_AUTH = import.meta.env.VITE_DISABLE_AUTH === "1";

/* ===================== Error Boundary (evita pantalla negra) ===================== */

class PageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, err: null };
  }
  static getDerivedStateFromError(err) {
    return { hasError: true, err };
  }
  componentDidCatch(err, info) {
    console.error("[UsersPage] render error:", err, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-transparent text-white p-6">
          <div className="max-w-3xl mx-auto border border-rose-500/40 bg-rose-500/10 rounded-2xl p-5">
            <div className="text-lg font-semibold text-rose-200 mb-2">
              Se cayó la pantalla de Usuarios por un error de render.
            </div>
            <div className="text-sm text-neutral-200">
              Revisa consola. Mensaje:
              <div className="mt-2 p-3 rounded-xl bg-black/40 border border-white/10 font-mono text-xs whitespace-pre-wrap">
                {String(this.state.err?.message || this.state.err || "Unknown error")}
              </div>
            </div>
            <button
              className="mt-4 px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 font-semibold"
              onClick={() => this.setState({ hasError: false, err: null })}
            >
              Reintentar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ===================== Helpers básicos ===================== */

function getPath(obj, path) {
  return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function getVal(obj, paths, fallback = "") {
  for (const p of paths) {
    const v = p.includes(".") ? getPath(obj, p) : obj?.[p];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return fallback;
}

/** Normaliza roles a array de códigos */
function normalizeRoles(api) {
  let roles = getVal(api, ["roles"], []);
  if (typeof roles === "string") roles = [roles];
  if (Array.isArray(roles)) {
    return roles
      .map((r) => (typeof r === "string" ? r : r?.code || r?.name || r?.nombre || r?.key || ""))
      .filter(Boolean);
  }
  return [];
}

/** Normaliza el objeto de backend a las claves del form (MINI) */
function mapUserToFormSafeMini(api = {}) {
  const nombreCompleto = getVal(api, ["nombreCompleto", "fullName", "name"], "");
  const email = getVal(api, ["email", "correoPersona", "correo", "mail"], "");
  const roles = normalizeRoles(api);

  const active =
    getVal(api, ["active"], undefined) ??
    (String(getVal(api, ["estado"], "")).toLowerCase() === "inactivo" ? false : true);

  const mustChangePassword =
    getVal(api, ["mustChangePassword"], undefined) ??
    getVal(api, ["forcePwChange"], undefined) ??
    false;

  return {
    nombreCompleto,
    email,
    roles,
    active,
    forcePwChange: !!mustChangePassword,
    _id: getVal(api, ["_id", "id"], undefined),
  };
}

/* ===================== UX helpers ===================== */

function useClickOutside(ref, handler, enabled = true) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;

    const onDown = (e) => {
      const el = ref?.current;
      if (!el) return;
      if (el.contains(e.target)) return;
      handlerRef.current?.(e);
    };

    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [ref, enabled]);
}

/* ===================== UI helpers ===================== */

function RoleBadges({ roles = [], roleLabelMap = {} }) {
  const labels = Array.isArray(roles) ? roles.map((code) => roleLabelMap[code] || code) : [];
  return (
    <div className="flex flex-wrap gap-1">
      {labels.length === 0 ? (
        <span className="text-neutral-500">—</span>
      ) : (
        labels.map((r, i) => (
          <span
            key={`${r}-${i}`}
            className="text-xs px-2 py-1 rounded-full border border-cyan-400/30 bg-cyan-500/5 text-cyan-100"
          >
            {r}
          </span>
        ))
      )}
    </div>
  );
}

function RoleSelect({ value = [], onChange, availableRoles = [] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useClickOutside(rootRef, () => setOpen(false), open);

  const selected = new Set(Array.isArray(value) ? value : []);
  const normalizedRoles = useMemo(
    () =>
      (availableRoles || [])
        .map((r) => ({
          code: r.code || r.key || r.name || r._id,
          label: r.name || r.label || r.code || r.key || r._id,
        }))
        .filter((r) => !!r.code),
    [availableRoles]
  );

  const toggle = (code) => {
    const copy = new Set(selected);
    if (copy.has(code)) copy.delete(code);
    else copy.add(code);
    onChange(Array.from(copy));
  };

  const labelSelected =
    normalizedRoles
      .filter((r) => selected.has(r.code))
      .map((r) => r.label)
      .join(", ") || "Seleccionar rol(es)";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-3 py-2 rounded-lg border border-cyan-500/30 bg-black/20 backdrop-blur text-left text-sm flex items-center gap-2"
      >
        <span className="truncate">{labelSelected}</span>
        <span className="ml-auto text-xs opacity-70">▾</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-60 overflow-auto rounded-xl border border-cyan-500/30 bg-black/60 backdrop-blur shadow-[0_0_25px_rgba(34,211,238,0.18)]">
          {normalizedRoles.length === 0 && (
            <div className="px-3 py-2 text-sm text-neutral-500">No hay roles configurados.</div>
          )}
          {normalizedRoles.map((r) => (
            <label
              key={r.code}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-cyan-500/10 cursor-pointer"
            >
              <input
                type="checkbox"
                className="scale-110 accent-cyan-500"
                checked={selected.has(r.code)}
                onChange={() => toggle(r.code)}
              />
              <span className="truncate">{r.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/* Reglas para validar password */
function passwordRules(p = "") {
  return {
    length: p.length >= 8,
    upper: /[A-Z]/.test(p),
    lower: /[a-z]/.test(p),
    digit: /\d/.test(p),
  };
}

/* ===================== Página principal ===================== */

function UsersPageInner() {
  const [items, setItems] = useState([]);
  const [roleCatalog, setRoleCatalog] = useState([]);

  const [q, setQ] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);

  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [errors, setErrors] = useState({});

  // ✅ Paginación REAL (backend)
  const PAGE_SIZE = 5;
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // evita race conditions
  const requestIdRef = useRef(0);

  // Form MINIMAL
  const empty = {
    nombreCompleto: "",
    email: "",
    roles: [],
    active: true,
    forcePwChange: true,
  };
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);

  const [creds, setCreds] = useState({ password: "", confirm: "" });
  const [showPwd, setShowPwd] = useState(false);

  const pwdR = passwordRules(creds.password);
  const match = creds.password && creds.confirm && creds.password === creds.confirm;
  const showPwdRules = creds.password && creds.password.length > 0;

  const firstFieldRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);

  const roleLabelMap = useMemo(
    () =>
      Object.fromEntries(
        (roleCatalog || []).map((r) => [
          r.code || r.key || r.name || r._id,
          r.name || r.label || r.code || r.key || "(sin nombre)",
        ])
      ),
    [roleCatalog]
  );

  function requireFn(fnName) {
    if (typeof iamApi?.[fnName] !== "function") {
      throw new Error(`iamApi.${fnName} no está implementado (por eso ves "Not implemented")`);
    }
    return iamApi[fnName];
  }

  function requireTokenOrNull() {
    if (DISABLE_AUTH) return null;
    const t = getTokenCanonical();
    return t || null;
  }

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function load({ append = false } = {}) {
    const myReqId = ++requestIdRef.current;

    try {
      setLoading(true);
      setErr("");

      const token = requireTokenOrNull();
      if (!DISABLE_AUTH && !token) {
        setErr("No se pudo obtener token de sesión. Inicia sesión de nuevo para gestionar usuarios.");
        setItems([]);
        setRoleCatalog([]);
        setTotal(0);
        setHasMore(false);
        return;
      }

      const listUsers = requireFn("listUsers");

      // si append => skip = items actuales, si no => 0
      const skip = append ? items.length : 0;

      const [resUsers, resRoles] = await Promise.all([
        listUsers(
          {
            q: q.trim(),
            onlyActive: onlyActive ? 1 : 0,
            limit: PAGE_SIZE,
            skip,
            createdFrom: createdFrom || "",
            createdTo: createdTo || "",
          },
          token
        ),
        typeof iamApi.listRoles === "function" ? iamApi.listRoles(token) : Promise.resolve({}),
      ]);

      // si llegó una respuesta vieja, ignórala
      if (myReqId !== requestIdRef.current) return;

      const newItems = Array.isArray(resUsers?.items) ? resUsers.items : [];
      const meta = resUsers?.meta || {};

      setItems((prev) => (append ? [...prev, ...newItems] : newItems));

      // fallback si backend no manda total/hasMore:
      const totalFromApi = Number(meta.total || 0);
      const hasMoreFromApi = typeof meta.hasMore === "boolean" ? meta.hasMore : undefined;

      if (totalFromApi > 0) {
        setTotal(totalFromApi);
      } else {
        // si no hay total, aproximamos con lo que llevamos cargado
        setTotal((append ? items.length + newItems.length : newItems.length) || 0);
      }

      if (hasMoreFromApi !== undefined) {
        setHasMore(hasMoreFromApi);
      } else {
        // heurística: si devolvió PAGE_SIZE, probablemente hay más
        setHasMore(newItems.length === PAGE_SIZE);
      }

      const rolesRaw = resRoles?.items || resRoles?.roles || [];
      setRoleCatalog(Array.isArray(rolesRaw) ? rolesRaw : []);
    } catch (e) {
      if (myReqId !== requestIdRef.current) return;
      setErr(e?.message || "Error al cargar usuarios");
    } finally {
      if (myReqId === requestIdRef.current) setLoading(false);
    }
  }

  // carga inicial
  useEffect(() => {
    load({ append: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // recargar cuando cambian filtros (debounce) + reset de lista (append=false)
  useEffect(() => {
    const t = setTimeout(() => load({ append: false }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, onlyActive, createdFrom, createdTo]);

  function validate() {
    const v = {};

    if (!form.nombreCompleto.trim()) v.nombreCompleto = "Requerido";

    if (!form.email.trim()) v.email = "Requerido";
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) v.email = "Correo inválido";

    if (!Array.isArray(form.roles) || form.roles.length === 0) {
      v.roles = "Seleccione al menos un rol";
    }

    if (creds.password || creds.confirm) {
      if (!creds.password) v.password = "Debe ingresar contraseña";
      if (!creds.confirm) v.confirm = "Debe confirmar la contraseña";
      if (creds.password !== creds.confirm) v.confirm = "Las contraseñas no coinciden";
      if (!pwdR.length || !pwdR.upper || !pwdR.lower || !pwdR.digit) {
        v.password = "La contraseña no cumple los requisitos mínimos";
      }
    }

    return v;
  }

  function buildPayload() {
    const payload = {
      nombreCompleto: form.nombreCompleto.trim(),
      email: form.email.trim().toLowerCase(),
      roles: Array.isArray(form.roles) ? form.roles : [],
      active: !!form.active,
      mustChangePassword: !!form.forcePwChange,
    };

    if (creds.password) payload.password = creds.password;
    return payload;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const v = validate();
    setErrors(v);

    const keys = Object.keys(v);
    if (keys.length) {
      const firstKey = keys[0];
      const el = document.querySelector(`[name="${firstKey}"]`);
      if (el?.focus) el.focus();
      alert("Corrija los errores del formulario antes de guardar.");
      return;
    }

    try {
      setSubmitting(true);

      const token = requireTokenOrNull();
      if (!DISABLE_AUTH && !token) {
        alert("No se pudo obtener token de sesión. Inicia sesión nuevamente para guardar.");
        return;
      }

      const payload = buildPayload();

      if (editing) {
        const updateUser = requireFn("updateUser");
        await updateUser(editing, payload, token);
        alert("Usuario actualizado correctamente");
      } else {
        const createUser = requireFn("createUser");
        await createUser(payload, token);
        alert("Usuario creado correctamente ✅");
      }

      setForm(empty);
      setEditing(null);
      setCreds({ password: "", confirm: "" });
      setErrors({});

      await load({ append: false });
    } catch (e2) {
      alert("⚠️ Error al guardar: " + (e2?.message || "Revisa la consola"));
      console.error("[UsersPage] submit error:", e2);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(u) {
    try {
      const token = requireTokenOrNull();
      if (!DISABLE_AUTH && !token) {
        alert("No se pudo obtener token de sesión. Inicia sesión nuevamente para cambiar estado.");
        return;
      }

      if (u.active === false) {
        const enableUser = requireFn("enableUser");
        await enableUser(u._id, token);
      } else {
        const disableUser = requireFn("disableUser");
        await disableUser(u._id, token);
      }

      await load({ append: false });
    } catch (e) {
      alert(e?.message || "No se pudo cambiar el estado");
    }
  }

  async function startEdit(u) {
    setEditing(u._id);
    setCreds({ password: "", confirm: "" });

    window.scrollTo({ top: 0, behavior: "smooth" });

    setLoading(true);
    let full = u;

    try {
      if (typeof iamApi.getUser === "function") {
        const token = requireTokenOrNull();
        const r = await iamApi.getUser(u._id, token);
        full = r?.item || r?.user || r || u;
      }
    } catch (e) {
      console.warn("[UsersPage] no se pudo obtener detalle; usando item de lista:", e);
    } finally {
      setLoading(false);
    }

    setForm((prev) => ({
      ...prev,
      ...mapUserToFormSafeMini(full),
    }));

    setTimeout(() => firstFieldRef.current?.focus?.(), 120);
  }

  function cancelEdit() {
    setEditing(null);
    setForm(empty);
    setCreds({ password: "", confirm: "" });
    setErrors({});
    setTimeout(() => firstFieldRef.current?.focus?.(), 300);
  }

  async function handleDelete(u) {
    const ok = window.confirm(`¿Seguro que deseas eliminar al usuario "${u.nombreCompleto || u.name || ""}"?`);
    if (!ok) return;

    try {
      const token = requireTokenOrNull();
      if (!DISABLE_AUTH && !token) {
        alert("No se pudo obtener token de sesión. Inicia sesión nuevamente para eliminar.");
        return;
      }

      if (typeof iamApi.deleteUser === "function") {
        await iamApi.deleteUser(u._id, token);
      } else {
        throw new Error("iamApi.deleteUser no está implementado");
      }

      if (editing === u._id) cancelEdit();
      await load({ append: false });
      alert("Usuario eliminado correctamente.");
    } catch (e) {
      alert(e?.message || "No se pudo eliminar el usuario");
    }
  }

  const visibleList = items;

  return (
    <div className="min-h-screen bg-transparent text-white p-6 md:p-8 space-y-8">
      <header className="max-w-5xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-semibold mb-2">Administración de Usuarios (IAM)</h1>
        <p className="text-sm text-neutral-300/80 max-w-2xl">
          Crea y administra usuarios del sistema SENAF: cuenta, roles y seguridad mínima.
        </p>
      </header>

      {/* Formulario principal (MINI) */}
      <section className="max-w-5xl mx-auto bg-transparent border border-cyan-500/25 rounded-2xl backdrop-blur-sm shadow-[0_0_30px_rgba(34,211,238,0.10)] p-5 md:p-7 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-lg md:text-xl font-semibold">{editing ? "Editar usuario" : "Registrar nuevo usuario"}</h2>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setForm(empty);
              setCreds({ password: "", confirm: "" });
              setErrors({});
            }}
            className="text-xs md:text-sm px-3 py-1.5 rounded-lg border border-cyan-500/40 hover:bg-cyan-500/10 transition-colors"
          >
            Limpiar formulario
          </button>
        </div>

        {err && (
          <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
            {err}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Nombre + Email */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm text-neutral-200">Nombre</label>
              <input
                ref={firstFieldRef}
                name="nombreCompleto"
                value={form.nombreCompleto}
                onChange={(e) => setField("nombreCompleto", e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-black/20 border border-cyan-500/30 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
                placeholder="Ej. Juan Pérez"
              />
              {errors.nombreCompleto && <p className="text-xs text-red-300">{errors.nombreCompleto}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-sm text-neutral-200">Email</label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-black/20 border border-cyan-500/30 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
                placeholder="usuario@dominio.com"
              />
              {errors.email && <p className="text-xs text-red-300">{errors.email}</p>}
            </div>
          </div>

          {/* Roles + estado */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm text-neutral-200">Rol(es)</label>
              <RoleSelect value={form.roles} onChange={(val) => setField("roles", val)} availableRoles={roleCatalog} />
              {errors.roles && <p className="text-xs text-red-300">{errors.roles}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-sm text-neutral-200">Estado</label>
              <select
                name="active"
                value={form.active ? "1" : "0"}
                onChange={(e) => setField("active", e.target.value === "1")}
                className="w-full px-3 py-2 rounded-lg bg-black/20 border border-cyan-500/30 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
              >
                <option value="1">Activo</option>
                <option value="0">Inactivo</option>
              </select>
            </div>
          </div>

          {/* Contraseña + Forzar cambio */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            <div className="space-y-1">
              <label className="text-sm text-neutral-200">
                Contraseña <span className="text-xs text-cyan-200/80 ml-2">(solo al crear o cambiar)</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type={showPwd ? "text" : "password"}
                  value={creds.password}
                  onChange={(e) => setCreds((prev) => ({ ...prev, password: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-black/20 border border-cyan-500/30 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  className="px-2 py-1 text-xs rounded-md border border-cyan-500/40 hover:bg-cyan-500/10"
                >
                  {showPwd ? "Ocultar" : "Ver"}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-300">{errors.password}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-sm text-neutral-200">Confirmar contraseña</label>
              <input
                type={showPwd ? "text" : "password"}
                name="confirm"
                className="w-full px-3 py-2 rounded-lg bg-black/20 border border-cyan-500/30 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
                value={creds.confirm}
                onChange={(e) => setCreds((prev) => ({ ...prev, confirm: e.target.value }))}
                placeholder="••••••••"
              />
              {errors.confirm && <span className="text-xs text-red-300">{errors.confirm}</span>}
              {!errors.confirm && creds.confirm && !match && <span className="text-xs text-red-300">No coincide con la contraseña.</span>}
            </div>

            <div className="space-y-1">
              <label className="text-sm text-neutral-200">Seguridad</label>
              <label className="flex items-center gap-2 text-xs text-neutral-200/80">
                <input
                  type="checkbox"
                  checked={!!form.forcePwChange}
                  onChange={(e) => setField("forcePwChange", e.target.checked)}
                />
                Forzar cambio de contraseña
              </label>
              <p className="text-[11px] text-neutral-300/60">
                Se envía al backend como <span className="font-mono">mustChangePassword</span>.
              </p>
            </div>
          </div>

          {showPwdRules && (
            <div className="text-xs text-neutral-200/80 bg-black/20 border border-cyan-500/25 rounded-lg px-3 py-2 space-y-1">
              <div className="font-semibold text-cyan-200 mb-1">Requisitos de contraseña:</div>
              <div>
                <span className={pwdR.length ? "text-green-300" : "text-red-300"}>• Al menos 8 caracteres</span>
              </div>
              <div>
                <span className={pwdR.upper ? "text-green-300" : "text-red-300"}>• Una letra mayúscula</span>
              </div>
              <div>
                <span className={pwdR.lower ? "text-green-300" : "text-red-300"}>• Una letra minúscula</span>
              </div>
              <div>
                <span className={pwdR.digit ? "text-green-300" : "text-red-300"}>• Un número</span>
              </div>
              <div>
                <span className={match ? "text-green-300" : "text-red-300"}>• Coincidencia entre contraseña y confirmación</span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={cancelEdit}
              className="px-4 py-2 text-sm rounded-lg border border-white/15 text-neutral-100 hover:bg-white/5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold shadow-[0_0_20px_rgba(34,211,238,0.35)] disabled:opacity-60"
            >
              {submitting ? "Guardando..." : editing ? "Guardar cambios" : "Crear usuario"}
            </button>
          </div>
        </form>
      </section>

      {/* Tabla de usuarios */}
      <section className="max-w-6xl mx-auto space-y-4">
        <div className="flex flex-col md:flex-row gap-3 justify-between items-start">
          <div>
            <h2 className="text-lg font-semibold mb-1">Usuarios registrados</h2>
            <p className="text-xs text-neutral-300/70">
              {items.length} de {total} usuario(s)
            </p>
          </div>

          {/* filtros */}
          <div className="flex flex-wrap gap-3 items-center">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre o correo..."
              className="px-3 py-1.5 rounded-lg bg-black/20 backdrop-blur border border-cyan-500/25 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />

            <input
              type="date"
              value={createdFrom}
              onChange={(e) => setCreatedFrom(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-black/20 backdrop-blur border border-cyan-500/25 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              title="Desde (creación)"
            />
            <input
              type="date"
              value={createdTo}
              onChange={(e) => setCreatedTo(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-black/20 backdrop-blur border border-cyan-500/25 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              title="Hasta (creación)"
            />

            <label className="flex items-center gap-2 text-xs text-neutral-200/80">
              <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />
              Mostrar solo activos
            </label>

            <button
              type="button"
              onClick={() => {
                setQ("");
                setCreatedFrom("");
                setCreatedTo("");
                setOnlyActive(true);
              }}
              className="text-xs px-3 py-1.5 rounded-lg border border-cyan-500/30 hover:bg-cyan-500/10"
              title="Quitar filtros"
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-cyan-500/20 bg-black/20 backdrop-blur shadow-[0_0_25px_rgba(34,211,238,0.12)]">
          <table className="min-w-full text-sm">
            <thead className="bg-black/20 text-xs uppercase text-neutral-300/70 border-b border-cyan-500/20">
              <tr>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left">Correo</th>
                <th className="px-4 py-3 text-left">Roles</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-neutral-300/70">
                    Cargando usuarios…
                  </td>
                </tr>
              ) : visibleList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-neutral-300/70">
                    No hay usuarios que coincidan con el filtro.
                  </td>
                </tr>
              ) : (
                visibleList.map((u) => (
                  <tr key={u._id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3">
                      <div className="font-medium text-neutral-100">{u.nombreCompleto || u.name || "(Sin nombre)"}</div>
                      <div className="text-[11px] text-neutral-300/60">
                        Creado: {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-neutral-200/90">{u.email || u.correoPersona || "—"}</td>

                    <td className="px-4 py-3">
                      <RoleBadges roles={u.roles} roleLabelMap={roleLabelMap} />
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold ${
                          u.active !== false
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-400/40"
                            : "bg-red-500/15 text-red-300 border border-red-400/40"
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full mr-1 bg-current" />
                        {u.active !== false ? "Activo" : "Inactivo"}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => toggleActive(u)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-md border ${
                          u.active !== false
                            ? "border-yellow-400/60 text-yellow-200 hover:bg-yellow-400/10"
                            : "border-emerald-400/60 text-emerald-200 hover:bg-emerald-400/10"
                        }`}
                      >
                        {u.active !== false ? "Desactivar" : "Activar"}
                      </button>

                      <button
                        type="button"
                        onClick={() => startEdit(u)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-md border border-cyan-400/60 text-cyan-200 hover:bg-cyan-400/10"
                      >
                        <Edit3 className="w-3 h-3" />
                        Editar
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(u)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-md border border-rose-500/60 text-rose-200 hover:bg-rose-500/10"
                      >
                        <Trash2 className="w-3 h-3" />
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {hasMore && (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={() => load({ append: true })}
              disabled={loading}
              className="px-4 py-2 text-sm rounded-lg border border-cyan-500/35 text-cyan-200 hover:bg-cyan-500/10 disabled:opacity-60"
            >
              {loading ? "Cargando..." : "Ver más usuarios"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

export default function UsersPage() {
  return (
    <PageErrorBoundary>
      <UsersPageInner />
    </PageErrorBoundary>
  );
}