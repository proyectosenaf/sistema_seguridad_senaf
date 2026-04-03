// src/i18n/index.js
import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import esCommon from "./locales/es/common.json";

import enCommon from "./locales/en/common.json";

import { DEFAULT_LANGUAGE } from "./languages";

const resources = {
  es: {
    common: esCommon,
    
  },
  en: {
    common: enCommon,
   
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: ["es", "en"],
    nonExplicitSupportedLngs: true,
    ns: ["common", "iam", "visitas", "accesos", "incidentes", "bitacora"],
    defaultNS: "common",
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"],
      lookupLocalStorage: "senaf_lang",
    },
    returnNull: false,
    returnEmptyString: false,
  });

i18n.on("languageChanged", (lng) => {
  const normalized = lng?.split("-")?.[0] || DEFAULT_LANGUAGE;
  document.documentElement.lang = normalized;
});

export default i18n;