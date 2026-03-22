import React from "react";

const initials = (name) =>
  (name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("") || "U";

function renderMessageContent(message) {
  if (message?.deleted) return "Mensaje eliminado";

  const type = String(message?.type || "text").trim().toLowerCase();

  if (type === "audio" && message?.audioUrl) {
    return (
      <audio controls preload="none" style={{ maxWidth: "220px" }}>
        <source src={message.audioUrl} />
      </audio>
    );
  }

  if (type === "image" && message?.fileUrl) {
    return (
      <a href={message.fileUrl} target="_blank" rel="noreferrer">
        <img
          src={message.fileUrl}
          alt={message?.fileName || "imagen"}
          style={{
            maxWidth: "220px",
            maxHeight: "220px",
            borderRadius: 12,
            display: "block",
          }}
        />
      </a>
    );
  }

  if (type === "file" && message?.fileUrl) {
    return (
      <a href={message.fileUrl} target="_blank" rel="noreferrer">
        {message?.fileName || "Archivo adjunto"}
      </a>
    );
  }

  return message?.text || "";
}

function fmtDate(v) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

export default function ChatMessageBubble({ message, mine, onEdit, onDelete }) {
  const displayName = mine
    ? "Tú"
    : message.user?.name || message.user?.email || "Desconocido";

  const seenCount = Array.isArray(message.seenBy) ? message.seenBy.length : 0;

  return (
    <div className={`chat-row ${mine ? "me" : ""}`}>
      {!mine && (
        <div className="chat-avatar" title={displayName}>
          {initials(displayName)}
        </div>
      )}

      <div className="chat-bubble">
        <div className="chat-meta">{displayName}</div>

        <div className={`chat-pill ${mine ? "me" : ""}`}>{renderMessageContent(message)}</div>

        <div className="chat-time">
          {fmtDate(message.createdAt || message.at)}
          {message.edited ? " · editado" : ""}
          {message.error ? " · ERROR" : ""}
          {message.optimistic ? " · ENVIANDO..." : ""}
          {mine && !message.deleted ? ` · ${seenCount > 0 ? "✔✔" : "✔"}` : ""}
        </div>

        {mine && !message.deleted && (
          <div
            style={{
              marginTop: 4,
              display: "flex",
              gap: 6,
              justifyContent: "flex-end",
            }}
          >
            {String(message.type || "text") === "text" && (
              <button type="button" style={{ fontSize: 11 }} onClick={() => onEdit(message)}>
                ✏️ Editar
              </button>
            )}

            <button type="button" style={{ fontSize: 11 }} onClick={() => onDelete(message)}>
              🗑️ Eliminar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
