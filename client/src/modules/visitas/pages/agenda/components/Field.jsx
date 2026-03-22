import React from "react";
import { sxInput } from "../styles.js";

export default function Field({
  label,
  name,
  value,
  onChange,
  error,
  placeholder,
  type = "text",
  children,
}) {
  return (
    <div>
      {label && (
        <label
          className="block mb-1 text-xs md:text-sm"
          style={{ color: "var(--text)" }}
        >
          {label}
        </label>
      )}

      {children ? (
        children
      ) : (
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full rounded-lg px-3 py-2 focus:outline-none"
          style={sxInput()}
        />
      )}

      {error && (
        <p className="text-xs mt-1" style={{ color: "#f87171" }}>
          {error}
        </p>
      )}
    </div>
  );
}
