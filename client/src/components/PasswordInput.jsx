import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function PasswordInput({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder || "Contraseña"}
        style={{ paddingRight: "40px", width: "100%" }}
      />

      <span
        onClick={() => setShow(!show)}
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
