import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function PasswordInput({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  const { t } = useTranslation();

  return (
    <div style={{ position: "relative" }}>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder || t("auth.placeholders.password")}
        style={{ paddingRight: "40px", width: "100%" }}
      />

      <span
        onClick={() => setShow(!show)}
        title={show ? t("auth.actions.hidePassword") : t("auth.actions.showPassword")}
        style={{
          position: "absolute",
          right: "10px",
          top: "50%",
          transform: "translateY(-50%)",
          cursor: "pointer"
        }}
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </span>
    </div>
  );
}