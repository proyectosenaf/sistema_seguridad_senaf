import React, { useEffect, useMemo, useRef, useState } from "react";
import { iamApi } from "../../api/iamApi.js";
import { Edit3, Trash2 } from "lucide-react";
import { getToken as getTokenCanonical } from "../../../lib/api.js";

const DISABLE_AUTH = import.meta.env.VITE_DISABLE_AUTH === "1";

function sxCard(extra = {}) {
  return {
    background: "color-mix(in srgb, var(--card) 90%, transparent)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-md)",
    backdropFilter: "blur(12px) saturate(130%)",
    WebkitBackdropFilter: "blur(12px) saturate(130%)",
    ...extra,
  };
}

function sxCardSoft(extra = {}) {
  return {
    background: "color-mix(in srgb, var(--card-solid) 88%, transparent)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-sm)",
    ...extra,
  };
}

function sxInput(extra = {}) {
  return {
    background: "var(--input-bg)",
    color: "var(--text)",
    border: "1px solid var(--input-border)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,.04)",
    ...extra,
  };
}

function sxBtnBase(extra = {}) {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.4rem",
    minHeight: "38px",
    padding: "0 14px",
    borderRadius: "12px",
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1,
    whiteSpace: "nowrap",
    transition:
      "transform .15s ease, box-shadow .15s ease, background .15s ease, border-color .15s ease, color .15s ease, opacity .15s ease",
    ...extra,
  };
}

function sxGhostBtn(extra = {}) {
  return sxBtnBase({
    background: "color-mix(in srgb, var(--card-solid) 90%, transparent)",
    color: "var(--text)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-sm)",
    ...extra,
  });
}

function sxPrimaryBtn(extra = {}) {
  return sxBtnBase({
    background: "linear-gradient(135deg, #2563eb, #06b6d4)",
    color: "#ffffff",
    border: "1px solid transparent",
    boxShadow: "0 10px 20px color-mix(in srgb, #2563eb 22%, transparent)",
    ...extra,
  });
}

function sxDangerBtn(extra = {}) {
  return sxBtnBase({
    background: "linear-gradient(135deg, #dc2626, #ef4444)",
    color: "#ffffff",
    border: "1px solid transparent",
    boxShadow: "0 10px 20px color-mix(in srgb, #dc2626 22%, transparent)",
    ...extra,
  });
}

function sxSuccessBtn(extra = {}) {
  return sxBtnBase({
    background: "linear-gradient(135deg, #16a34a, #22c55e)",
    color: "#ffffff",
    border: "1px solid transparent",
    boxShadow: "0 10px 20px color-mix(in srgb, #16a34a 22%, transparent)",
    ...extra,
  });
}

function sxWarningBtn(extra = {}) {
  return sxBtnBase({
    background: "color-mix(in srgb, #f59e0b 12%, var(--card-solid))",
    color: "#d97706",
    border: "1px solid color-mix(in srgb, #f59e0b 35%, transparent)",
    boxShadow: "var(--shadow-sm)",
    ...extra,
  });
}

function sxTableActionBtn(kind = "neutral", extra = {}) {
  const common = {
    minHeight: "34px",
    padding: "0 12px",
    borderRadius: "11px",
    fontSize: "12px",
    fontWeight: 600,
  };

  if (kind === "warning") {
    return sxBtnBase({
      ...common,
      background: "color-mix(in srgb, #f59e0b 12%, var(--card-solid))",
      color: "#d97706",
      border: "1px solid color-mix(in srgb, #f59e0b 34%, transparent)",
      boxShadow: "var(--shadow-sm)",
      ...extra,
    });
  }

  if (kind === "success") {
    return sxBtnBase({
      ...common,
      background: "color-mix(in srgb, #22c55e 12%, var(--card-solid))",
      color: "#15803d",
      border: "1px solid color-mix(in srgb, #22c55e 34%, transparent)",
      boxShadow: "var(--shadow-sm)",
      ...extra,
    });
  }

  if (kind === "danger") {
    return sxBtnBase({
      ...common,
      background: "color-mix(in srgb, #ef4444 10%, var(--card-solid))",
      color: "#dc2626",
      border: "1px solid color-mix(in srgb, #ef4444 28%, transparent)",
      boxShadow: "var(--shadow-sm)",
      ...extra,
    });
  }

  return sxBtnBase({
    ...common,
    background: "color-mix(in srgb, var(--card-solid) 92%, transparent)",
    color: "var(--text)",
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-sm)",
    ...extra,
  });
}

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
        <div className="min-h-screen p-6">
          <div className="max-w-3xl mx-auto rounded-[24px] p-5" style={sxCard()}>
            <div className="text-lg font-semibold mb-2" style={{ color: "#fecaca" }}>
              Se cayó la pantalla de Usuarios por un error de render.
            </div>
            <div className="text-sm" style={{ color: "var(--text)" }}>
              Revisa consola. Mensaje:
              <div
                className="mt-2 p-3 rounded-xl font-mono text-xs whitespace-pre-wrap"
                style={{
                  background: "color-mix(in srgb, var(--card-solid) 88%, transparent)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                }}
              >
                {String(this.state.err?.message || this.state.err || "Unknown error")}
              </div>
            </div>
            <button
              className="mt-4"
              style={sxPrimaryBtn()}
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

function normalizeRoles(api) {
  let roles = getVal(api, ["roles"], []);
  if (typeof roles === "string") roles = [roles];
  if (Array.isArray(roles)) {
    return roles
      .map((r) =>
        typeof r === "string" ? r : r?.code || r?.name || r?.nombre || r?.key || ""
      )
      .filter(Boolean);
  }
  return [];
}

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

function RoleBadges({ roles = [], roleLabelMap = {} }) {
  const labels = Array.isArray(roles) ? roles.map((code) => roleLabelMap[code] || code) : [];

  return (
    <div className="flex flex-wrap gap-1.5">
      {labels.length === 0 ? (
        <span style={{ color: "var(--text-muted)" }}>—</span>
      ) : (
        labels.map((r, i) => (
          <span
            key={`${r}-${i}`}
            className="text-xs px-2.5 py-1 rounded-full"
            style={{
              background: "color-mix(in srgb, #06b6d4 10%, transparent)",
              color: "#0f766e",
              border: "1px solid color-mix(in srgb, #06b6d4 26%, transparent)",
              fontWeight: 600,
            }}
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
        className="w-full px-3 py-2 rounded-lg text-left text-sm flex items-center gap-2"
        style={sxInput({ minHeight: "42px" })}
      >
        <span className="truncate">{labelSelected}</span>
        <span className="ml-auto text-xs opacity-70">▾</span>
      </button>

      {open && (
        <div
          className="absolute z-30 mt-1 w-full max-h-60 overflow-auto rounded-xl"
          style={sxCard()}
        >
          {normalizedRoles.length === 0 && (
            <div className="px-3 py-2 text-sm" style={{ color: "var(--text-muted)" }}>
              No hay roles configurados.
            </div>
          )}

          {normalizedRoles.map((r) => (
            <label
              key={r.code}
              className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer"
              style={{ color: "var(--text)" }}
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

function passwordRules(p = "") {
  return {
    length: p.length >= 8,
    upper: /[A-Z]/.test(p),
    lower: /[a-z]/.test(p),
    digit: /\d/.test(p),
  };
}

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

  const PAGE_SIZE = 5;
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const requestIdRef = useRef(0);

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

      if (myReqId !== requestIdRef.current) return;

      const newItems = Array.isArray(resUsers?.items) ? resUsers.items : [];
      const meta = resUsers?.meta || {};

      setItems((prev) => (append ? [...prev, ...newItems] : newItems));

      const totalFromApi = Number(meta.total || 0);
      const hasMoreFromApi = typeof meta.hasMore === "boolean" ? meta.hasMore : undefined;

      if (totalFromApi > 0) {
        setTotal(totalFromApi);
      } else {
        setTotal((append ? items.length + newItems.length : newItems.length) || 0);
      }

      if (hasMoreFromApi !== undefined) {
        setHasMore(hasMoreFromApi);
      } else {
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

  useEffect(() => {
    load({ append: false });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load({ append: false }), 250);
    return () => clearTimeout(t);
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
    const ok = window.confirm(
      `¿Seguro que deseas eliminar al usuario "${u.nombreCompleto || u.name || ""}"?`
    );
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
    <div className="min-h-screen p-6 md:p-8 space-y-8">
      <header className="max-w-5xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-semibold mb-2" style={{ color: "var(--text)" }}>
          Administración de Usuarios (IAM)
        </h1>
        <p className="text-sm max-w-2xl" style={{ color: "var(--text-muted)" }}>
          Crea y administra usuarios del sistema SENAF: cuenta, roles y seguridad mínima.
        </p>
      </header>

      <section className="max-w-5xl mx-auto rounded-[24px] p-5 md:p-7 space-y-6" style={sxCard()}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-lg md:text-xl font-semibold" style={{ color: "var(--text)" }}>
            {editing ? "Editar usuario" : "Registrar nuevo usuario"}
          </h2>

          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setForm(empty);
              setCreds({ password: "", confirm: "" });
              setErrors({});
            }}
            style={sxGhostBtn()}
          >
            Limpiar formulario
          </button>
        </div>

        {err && (
          <div
            className="text-sm rounded-lg px-3 py-2"
            style={{
              background: "color-mix(in srgb, #ef4444 10%, transparent)",
              border: "1px solid color-mix(in srgb, #ef4444 26%, transparent)",
              color: "#fca5a5",
            }}
          >
            {err}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm" style={{ color: "var(--text)" }}>
                Nombre
              </label>
              <input
                ref={firstFieldRef}
                name="nombreCompleto"
                value={form.nombreCompleto}
                onChange={(e) => setField("nombreCompleto", e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                style={sxInput({ minHeight: "42px" })}
                placeholder="Ej. Juan Pérez"
              />
              {errors.nombreCompleto && (
                <p className="text-xs" style={{ color: "#fca5a5" }}>
                  {errors.nombreCompleto}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm" style={{ color: "var(--text)" }}>
                Email
              </label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                style={sxInput({ minHeight: "42px" })}
                placeholder="usuario@dominio.com"
              />
              {errors.email && (
                <p className="text-xs" style={{ color: "#fca5a5" }}>
                  {errors.email}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm" style={{ color: "var(--text)" }}>
                Rol(es)
              </label>
              <RoleSelect
                value={form.roles}
                onChange={(val) => setField("roles", val)}
                availableRoles={roleCatalog}
              />
              {errors.roles && (
                <p className="text-xs" style={{ color: "#fca5a5" }}>
                  {errors.roles}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm" style={{ color: "var(--text)" }}>
                Estado
              </label>
              <select
                name="active"
                value={form.active ? "1" : "0"}
                onChange={(e) => setField("active", e.target.value === "1")}
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                style={sxInput({ minHeight: "42px" })}
              >
                <option value="1">Activo</option>
                <option value="0">Inactivo</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            <div className="space-y-1">
              <label className="text-sm" style={{ color: "var(--text)" }}>
                Contraseña{" "}
                <span className="text-xs ml-2" style={{ color: "var(--text-muted)" }}>
                  (solo al crear o cambiar)
                </span>
              </label>

              <div className="flex items-center gap-2">
                <input
                  type={showPwd ? "text" : "password"}
                  value={creds.password}
                  onChange={(e) => setCreds((prev) => ({ ...prev, password: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={sxInput({ minHeight: "42px" })}
                  placeholder="••••••••"
                />

                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  style={sxGhostBtn({ minHeight: "42px", padding: "0 12px" })}
                >
                  {showPwd ? "Ocultar" : "Ver"}
                </button>
              </div>

              {errors.password && (
                <p className="text-xs" style={{ color: "#fca5a5" }}>
                  {errors.password}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm" style={{ color: "var(--text)" }}>
                Confirmar contraseña
              </label>
              <input
                type={showPwd ? "text" : "password"}
                name="confirm"
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                style={sxInput({ minHeight: "42px" })}
                value={creds.confirm}
                onChange={(e) => setCreds((prev) => ({ ...prev, confirm: e.target.value }))}
                placeholder="••••••••"
              />

              {errors.confirm && (
                <span className="text-xs" style={{ color: "#fca5a5" }}>
                  {errors.confirm}
                </span>
              )}

              {!errors.confirm && creds.confirm && !match && (
                <span className="text-xs" style={{ color: "#fca5a5" }}>
                  No coincide con la contraseña.
                </span>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-sm" style={{ color: "var(--text)" }}>
                Seguridad
              </label>

              <label
                className="flex items-center gap-2 text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                <input
                  type="checkbox"
                  checked={!!form.forcePwChange}
                  onChange={(e) => setField("forcePwChange", e.target.checked)}
                />
                Forzar cambio de contraseña
              </label>

              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                Se envía al backend como <span className="font-mono">mustChangePassword</span>.
              </p>
            </div>
          </div>

          {showPwdRules && (
            <div className="text-xs rounded-lg px-3 py-2 space-y-1" style={sxCardSoft()}>
              <div className="font-semibold mb-1" style={{ color: "#67e8f9" }}>
                Requisitos de contraseña:
              </div>
              <div>
                <span style={{ color: pwdR.length ? "#86efac" : "#fca5a5" }}>
                  • Al menos 8 caracteres
                </span>
              </div>
              <div>
                <span style={{ color: pwdR.upper ? "#86efac" : "#fca5a5" }}>
                  • Una letra mayúscula
                </span>
              </div>
              <div>
                <span style={{ color: pwdR.lower ? "#86efac" : "#fca5a5" }}>
                  • Una letra minúscula
                </span>
              </div>
              <div>
                <span style={{ color: pwdR.digit ? "#86efac" : "#fca5a5" }}>
                  • Un número
                </span>
              </div>
              <div>
                <span style={{ color: match ? "#86efac" : "#fca5a5" }}>
                  • Coincidencia entre contraseña y confirmación
                </span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2 flex-wrap">
            <button type="button" onClick={cancelEdit} style={sxGhostBtn()}>
              Cancelar
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="disabled:opacity-60"
              style={sxPrimaryBtn()}
            >
              {submitting ? "Guardando..." : editing ? "Guardar cambios" : "Crear usuario"}
            </button>
          </div>
        </form>
      </section>

      <section className="max-w-6xl mx-auto space-y-4">
        <div className="flex flex-col md:flex-row gap-3 justify-between items-start">
          <div>
            <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--text)" }}>
              Usuarios registrados
            </h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {items.length} de {total} usuario(s)
            </p>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre o correo..."
              className="px-3 py-1.5 rounded-lg text-sm focus:outline-none"
              style={sxInput({ minHeight: "40px" })}
            />

            <input
              type="date"
              value={createdFrom}
              onChange={(e) => setCreatedFrom(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm focus:outline-none"
              style={sxInput({ minHeight: "40px" })}
              title="Desde (creación)"
            />

            <input
              type="date"
              value={createdTo}
              onChange={(e) => setCreatedTo(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm focus:outline-none"
              style={sxInput({ minHeight: "40px" })}
              title="Hasta (creación)"
            />

            <label
              className="flex items-center gap-2 text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              <input
                type="checkbox"
                checked={onlyActive}
                onChange={(e) => setOnlyActive(e.target.checked)}
              />
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
              title="Quitar filtros"
              style={sxGhostBtn({ minHeight: "40px" })}
            >
              Limpiar filtros
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-[24px]" style={sxCard()}>
          <table className="min-w-full text-sm" style={{ color: "var(--text)" }}>
            <thead
              className="text-xs uppercase"
              style={{
                color: "var(--text-muted)",
                borderBottom: "1px solid var(--border)",
                background: "color-mix(in srgb, var(--card-solid) 92%, transparent)",
              }}
            >
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
                  <td colSpan={5} className="px-4 py-6 text-center" style={{ color: "var(--text-muted)" }}>
                    Cargando usuarios…
                  </td>
                </tr>
              ) : visibleList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center" style={{ color: "var(--text-muted)" }}>
                    No hay usuarios que coincidan con el filtro.
                  </td>
                </tr>
              ) : (
                visibleList.map((u) => (
                  <tr key={u._id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="px-4 py-3">
                      <div className="font-medium" style={{ color: "var(--text)" }}>
                        {u.nombreCompleto || u.name || "(Sin nombre)"}
                      </div>
                      <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        Creado: {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                      </div>
                    </td>

                    <td className="px-4 py-3" style={{ color: "var(--text)" }}>
                      {u.email || u.correoPersona || "—"}
                    </td>

                    <td className="px-4 py-3">
                      <RoleBadges roles={u.roles} roleLabelMap={roleLabelMap} />
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold"
                        style={
                          u.active !== false
                            ? {
                                background: "color-mix(in srgb, #22c55e 12%, transparent)",
                                color: "#15803d",
                                border: "1px solid color-mix(in srgb, #22c55e 36%, transparent)",
                              }
                            : {
                                background: "color-mix(in srgb, #ef4444 12%, transparent)",
                                color: "#dc2626",
                                border: "1px solid color-mix(in srgb, #ef4444 36%, transparent)",
                              }
                        }
                      >
                        <span className="w-2 h-2 rounded-full mr-1 bg-current" />
                        {u.active !== false ? "Activo" : "Inactivo"}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex justify-end flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => toggleActive(u)}
                          style={sxTableActionBtn(u.active !== false ? "warning" : "success")}
                        >
                          {u.active !== false ? "Desactivar" : "Activar"}
                        </button>

                        <button
                          type="button"
                          onClick={() => startEdit(u)}
                          style={sxTableActionBtn("neutral")}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Editar
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(u)}
                          style={sxTableActionBtn("danger")}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Eliminar
                        </button>
                      </div>
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
              className="disabled:opacity-60"
              style={sxGhostBtn()}
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