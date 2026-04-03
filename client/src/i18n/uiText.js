export function getTranslatedStatus(t, moduleName, rawStatus) {
  if (!rawStatus) return "-";
  return t(`status.${rawStatus}`, { ns: moduleName, defaultValue: rawStatus });
}

export function getYesNoLabel(t, value) {
  return value ? t("status.yes", { ns: "common" }) : t("status.no", { ns: "common" });
}

export function formatDateByLanguage(dateValue, language) {
  if (!dateValue) return "-";

  const lang = String(language || "es").toLowerCase().startsWith("en")
    ? "en-US"
    : "es-HN";

  return new Intl.DateTimeFormat(lang, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(dateValue));
}

export function formatDateTimeByLanguage(dateValue, language) {
  if (!dateValue) return "-";

  const lang = String(language || "es").toLowerCase().startsWith("en")
    ? "en-US"
    : "es-HN";

  return new Intl.DateTimeFormat(lang, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateValue));
}