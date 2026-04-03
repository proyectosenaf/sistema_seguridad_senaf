import React, { useMemo, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { API as API_BASE } from "../../lib/api.js";
import AuthBackground from "../../components/AuthBackground.jsx";

function inputClass() {
  return "border border-slate-300/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 w-full p-2 rounded outline-none focus:ring-2 focus:ring-blue-500/30";
}

function validatePassword(password) {
  const s = String(password || "");
  return (
    s.length >= 8 &&
    /[A-Za-z]/.test(s) &&
    /\d/.test(s) &&
    /[^A-Za-z0-9]/.test(s)
  );
}

function getPasswordChecks(password) {
  const s = String(password || "");
  return {
    length: s.length >= 8,
    letter: /[A-Za-z]/.test(s),
    number: /\d/.test(s),
    special: /[^A-Za-z0-9]/.test(s),
  };
}

function humanResetError(codeOrMsg, t) {
  const s = String(codeOrMsg || "").toLowerCase();

  if (s.includes("missing_fields")) return t("auth.resetPassword.errors.missingFields");
  if (s.includes("password_mismatch")) return t("auth.resetPassword.errors.passwordMismatch");
  if (s.includes("invalid_password")) {
    return t("auth.resetPassword.errors.invalidPassword");
  }
  if (s.includes("invalid_reset")) return t("auth.resetPassword.errors.invalidReset");
  if (s.includes("reset_not_requested")) return t("auth.resetPassword.errors.resetNotRequested");
  if (s.includes("reset_already_used")) return t("auth.resetPassword.errors.resetAlreadyUsed");
  if (s.includes("reset_expired")) return t("auth.resetPassword.errors.resetExpired");
  if (s.includes("too_many_attempts")) return t("auth.resetPassword.errors.tooManyAttempts");
  if (s.includes("invalid_reset_token")) return t("auth.resetPassword.errors.invalidResetToken");
  if (s.includes("network error")) return t("auth.resetPassword.errors.networkError");

  return codeOrMsg || t("auth.resetPassword.errors.generic");
}

export default function ResetPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    token: "",
    passwordNueva: "",
    confirmarPassword: "",
  });

  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const checks = getPasswordChecks(form.passwordNueva);

  const publicApi = useMemo(() => {
    const base = String(API_BASE || "http://localhost:4000/api")
      .trim()
      .replace(/\/$/, "");

    return axios.create({
      baseURL: base,
      withCredentials: false,
      timeout: 30000,
      headers: {
        "Cache-Control": "no-store",
        Pragma: "no-cache",
        "Content-Type": "application/json",
      },
    });
  }, []);

  function onChange(e) {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg("");
    setError("");

    const email = String(form.email || "").trim().toLowerCase();
    const token = String(form.token || "").trim().toUpperCase();
    const passwordNueva = String(form.passwordNueva || "");
    const confirmarPassword = String(form.confirmarPassword || "");

    if (!email || !token || !passwordNueva || !confirmarPassword) {
      setError(t("auth.resetPassword.errors.missingFields"));
      return;
    }

    if (!validatePassword(passwordNueva)) {
      setError(t("auth.resetPassword.errors.invalidPassword"));
      return;
    }

    if (passwordNueva !== confirmarPassword) {
      setError(t("auth.resetPassword.errors.passwordMismatch"));
      return;
    }

    setLoading(true);

    try {
      const { data } = await publicApi.post("/public/v1/password/reset-password", {
        email,
        token,
        passwordNueva,
        confirmarPassword,
      });

      if (data?.ok === false) {
        setError(humanResetError(data?.error || data?.message, t));
        return;
      }

      setMsg(data?.message || t("auth.resetPassword.success.updated"));
      setTimeout(() => navigate("/login", { replace: true }), 1200);
    } catch (err) {
      const d = err?.response?.data;
      const msg =
        (d && typeof d === "object" && (d.error || d.message || d.details)) ||
        err?.message ||
        t("auth.resetPassword.errors.generic");

      console.error("[ResetPassword] error:", {
        status: err?.response?.status,
        data: err?.response?.data,
        message: err?.message,
      });

      setError(humanResetError(msg, t));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthBackground imageUrl="/images/senaf-bg.png" variant="cover" opacity={0.5} blurPx={0}>
      <div className="w-[400px]">
        <div className="relative bg-white/90 dark:bg-slate-900/85 shadow-sm border border-slate-200/80 dark:border-slate-800/80 rounded backdrop-blur-md">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06] dark:opacity-[0.05] bg-center bg-no-repeat bg-contain"
            style={{ backgroundImage: "url('/images/senaf-bg.png')" }}
          />

          <div className="relative z-10 p-6">
            <h1 className="text-3xl mb-2 font-bold text-slate-900 dark:text-slate-100">
              {t("auth.resetPassword.title")}
            </h1>

            <p className="mb-6 text-sm text-slate-600 dark:text-slate-300">
              {t("auth.resetPassword.subtitle")}
            </p>

            <form onSubmit={handleSubmit}>
              <input
                className={`${inputClass()} mb-3`}
                name="email"
                type="email"
                placeholder={t("auth.resetPassword.placeholders.email")}
                value={form.email}
                onChange={onChange}
                autoComplete="email"
              />

              <input
                className={`${inputClass()} mb-3`}
                name="token"
                type="text"
                placeholder={t("auth.resetPassword.placeholders.token")}
                value={form.token}
                onChange={(e) =>
                  setForm((s) => ({
                    ...s,
                    token: e.target.value.toUpperCase().replace(/\s+/g, ""),
                  }))
                }
              />

              <div className="relative mb-2">
                <input
                  className={`${inputClass()} pr-10`}
                  name="passwordNueva"
                  type={showPass ? "text" : "password"}
                  placeholder={t("auth.resetPassword.placeholders.newPassword")}
                  value={form.passwordNueva}
                  onChange={onChange}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500"
                  aria-label={
                    showPass
                      ? t("auth.resetPassword.actions.hidePassword")
                      : t("auth.resetPassword.actions.showPassword")
                  }
                  title={
                    showPass
                      ? t("auth.resetPassword.actions.hidePassword")
                      : t("auth.resetPassword.actions.showPassword")
                  }
                >
                  {showPass ? "🙈" : "👁️"}
                </button>
              </div>

              <div className="mb-3 rounded border border-slate-200/70 bg-slate-50/80 px-3 py-2 text-xs text-slate-600 dark:border-slate-700/70 dark:bg-slate-900/40 dark:text-slate-300">
                <div className="mb-1 font-medium">
                  {t("auth.resetPassword.passwordRules.summary")}
                </div>
                <div className={checks.length ? "text-emerald-600" : "text-slate-500"}>
                  {checks.length ? "✓" : "•"} {t("auth.resetPassword.passwordRules.minLength")}
                </div>
                <div className={checks.letter ? "text-emerald-600" : "text-slate-500"}>
                  {checks.letter ? "✓" : "•"} {t("auth.resetPassword.passwordRules.letter")}
                </div>
                <div className={checks.number ? "text-emerald-600" : "text-slate-500"}>
                  {checks.number ? "✓" : "•"} {t("auth.resetPassword.passwordRules.number")}
                </div>
                <div className={checks.special ? "text-emerald-600" : "text-slate-500"}>
                  {checks.special ? "✓" : "•"} {t("auth.resetPassword.passwordRules.special")}
                </div>
              </div>

              <div className="relative mb-3">
                <input
                  className={`${inputClass()} pr-10`}
                  name="confirmarPassword"
                  type={showConfirm ? "text" : "password"}
                  placeholder={t("auth.resetPassword.placeholders.confirmPassword")}
                  value={form.confirmarPassword}
                  onChange={onChange}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500"
                  aria-label={
                    showConfirm
                      ? t("auth.resetPassword.actions.hideConfirmation")
                      : t("auth.resetPassword.actions.showConfirmation")
                  }
                  title={
                    showConfirm
                      ? t("auth.resetPassword.actions.hideConfirmation")
                      : t("auth.resetPassword.actions.showConfirmation")
                  }
                >
                  {showConfirm ? "🙈" : "👁️"}
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white w-full p-2 rounded"
              >
                {loading
                  ? t("auth.resetPassword.actions.updating")
                  : t("auth.resetPassword.actions.saveNewPassword")}
              </button>
            </form>

            {msg ? <div className="mt-4 text-sm text-emerald-700">{msg}</div> : null}
            {error ? <div className="mt-4 text-sm text-red-600">{error}</div> : null}

            <div className="mt-6 flex items-center justify-between">
              <Link to="/forgot-password" className="text-blue-600 hover:underline">
                {t("auth.resetPassword.links.requestNewCode")}
              </Link>

              <Link to="/login" className="text-slate-600 hover:underline">
                {t("auth.resetPassword.links.backToLogin")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AuthBackground>
  );
}