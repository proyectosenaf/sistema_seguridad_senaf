import React from "react";

export default function FileUploadButton({ onFileSelected, accept = "*/*" }) {
  const inputRef = React.useRef(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelected?.(file);
          e.target.value = "";
        }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="chat-header__close"
        title="Adjuntar archivo"
        aria-label="Adjuntar archivo"
      >
        📎
      </button>
    </>
  );
}
