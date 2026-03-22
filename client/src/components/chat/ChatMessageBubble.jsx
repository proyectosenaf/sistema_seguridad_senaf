import React from "react";

function formatDate(value) {
  if (!value) return "";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString();
  } catch {
    return "";
  }
}

function getUserId(u) {
  return (
    u?.id ||
    u?._id ||
    u?.sub ||
    u?.userId ||
    u?.uid ||
    u?.email ||
    u?.correo ||
    null
  );
}

function isSeenByOthers(message, myId) {
  if (!message || !Array.isArray(message.seenBy) || !myId) return false;

  return message.seenBy.some((x) => {
    const seenId = String(x?.userId || "").trim();
    return seenId && seenId !== String(myId).trim();
  });
}

function getSenderName(message, isMine) {
  if (isMine) return "Tú";

  return (
    message?.user?.name ||
    message?.user?.nombre ||
    message?.user?.fullName ||
    message?.user?.displayName ||
    message?.user?.email ||
    "Usuario"
  );
}

function renderDeletedBubble(isMine) {
  return (
    <div
      className={`chat-message__bubble ${isMine ? "mine" : "other"} deleted`}
      style={{
        opacity: 0.82,
        fontStyle: "italic",
      }}
    >
      Mensaje eliminado
    </div>
  );
}

function renderTextBubble(message, isMine) {
  return (
    <div className={`chat-message__bubble ${isMine ? "mine" : "other"}`}>
      {message?.text || ""}
    </div>
  );
}

function renderImageBubble(message, isMine) {
  const src = message?.fileUrl || "";
  const caption = message?.text || message?.fileName || "";

  return (
    <div className={`chat-message__bubble ${isMine ? "mine" : "other"} image`}>
      {src ? (
        <a
          href={src}
          target="_blank"
          rel="noreferrer"
          className="chat-message__image-link"
        >
          <img
            src={src}
            alt={message?.fileName || "Imagen adjunta"}
            className="chat-message__image"
          />
        </a>
      ) : (
        <div className="chat-message__file-fallback">Imagen no disponible</div>
      )}

      {caption ? (
        <div className="chat-message__caption">
          {caption}
        </div>
      ) : null}
    </div>
  );
}

function renderAudioBubble(message, isMine) {
  const src = message?.audioUrl || message?.fileUrl || "";

  return (
    <div className={`chat-message__bubble ${isMine ? "mine" : "other"} audio`}>
      {src ? (
        <audio
          controls
          preload="metadata"
          className="chat-message__audio"
          src={src}
        />
      ) : (
        <div className="chat-message__file-fallback">Audio no disponible</div>
      )}
    </div>
  );
}

function renderFileBubble(message, isMine) {
  const href = message?.fileUrl || "";
  const fileName = message?.fileName || message?.text || "Archivo";

  return (
    <div className={`chat-message__bubble ${isMine ? "mine" : "other"} file`}>
      <div className="chat-message__file-row">
        <span className="chat-message__file-icon">📎</span>

        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="chat-message__file-link"
            title={fileName}
          >
            {fileName}
          </a>
        ) : (
          <span className="chat-message__file-fallback">{fileName}</span>
        )}
      </div>
    </div>
  );
}

export default function ChatMessageBubble({
  message,
  myId,
  onEdit,
  onDelete,
}) {
  const ownerId =
    message?.user?.id ||
    message?.user?._id ||
    message?.user?.sub ||
    message?.user?.email ||
    null;

  const isMine =
    (ownerId && myId && String(ownerId) === String(myId)) ||
    getUserId(message?.user) === myId;

  const senderName = getSenderName(message, isMine);
  const createdAt = formatDate(message?.createdAt);
  const seen = isMine && isSeenByOthers(message, myId);
  const canManage = isMine && !message?.deleted;

  const type = String(message?.type || "text").toLowerCase();
  const isDeleted = !!message?.deleted;
  const isEdited = !!message?.edited;
  const hasError = !!message?.error;
  const isOptimistic = !!message?.optimistic;

  let content = null;

  if (isDeleted) {
    content = renderDeletedBubble(isMine);
  } else if (type === "audio") {
    content = renderAudioBubble(message, isMine);
  } else if (type === "image") {
    content = renderImageBubble(message, isMine);
  } else if (type === "file") {
    content = renderFileBubble(message, isMine);
  } else {
    content = renderTextBubble(message, isMine);
  }

  return (
    <div
      className={`chat-message ${isMine ? "mine" : "other"}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isMine ? "flex-end" : "flex-start",
        gap: 6,
        marginBottom: 14,
      }}
    >
      <div
        className="chat-message__sender"
        style={{
          fontSize: 12,
          opacity: 0.8,
          paddingInline: 2,
        }}
      >
        {senderName}
      </div>

      {content}

      <div
        className="chat-message__meta"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          fontSize: 12,
          opacity: 0.8,
          paddingInline: 2,
          maxWidth: "100%",
        }}
      >
        <span>{createdAt}</span>

        {isEdited && !isDeleted ? <span>(editado)</span> : null}
        {isOptimistic ? <span>Enviando...</span> : null}
        {hasError ? <span style={{ color: "#f87171" }}>Error</span> : null}
        {seen ? <span title="Visto">✔✔</span> : null}
      </div>

      {canManage && (
        <div
          className="chat-message__actions"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "center",
            maxWidth: "100%",
            paddingInline: 2,
          }}
        >
          <button
            type="button"
            onClick={() => onEdit?.(message)}
            className="chat-message__action-btn"
            title="Editar mensaje"
            style={{
              background: "transparent",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              padding: 0,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
            }}
          >
            <span>✏️</span>
            <span>Editar</span>
          </button>

          <button
            type="button"
            onClick={() => onDelete?.(message)}
            className="chat-message__action-btn danger"
            title="Eliminar mensaje"
            style={{
              background: "transparent",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              padding: 0,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
            }}
          >
            <span>🗑️</span>
            <span>Eliminar</span>
          </button>
        </div>
      )}
    </div>
  );
}