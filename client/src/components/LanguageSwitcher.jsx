import React from "react";
import { useTranslation } from "react-i18next";

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const changeLang = (lng) => {
    i18n.changeLanguage(lng);
    localStorage.setItem("senaf_lang", lng);
  };

  return (
    <select
      value={i18n.resolvedLanguage || i18n.language}
      onChange={(e) => changeLang(e.target.value)}
      className="rounded-lg border px-2 py-1 text-sm"
    >
      <option value="es">ES</option>
      <option value="en">EN</option>
    </select>
  );
}