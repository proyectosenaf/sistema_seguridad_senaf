// src/i18n/languages.js
export const SUPPORTED_LANGUAGES = [
  { code: "es", label: "Español", locale: "es-HN" },
  { code: "en", label: "English", locale: "en-US" },
];

export const DEFAULT_LANGUAGE = "es";

export function normalizeLanguageCode(value) {
  if (!value) return DEFAULT_LANGUAGE;

  const clean = String(value).trim().toLowerCase();

  if (clean.startsWith("es")) return "es";
  if (clean.startsWith("en")) return "en";

  return DEFAULT_LANGUAGE;
}