import React from "react";
import ChatMessageBubble from "./ChatMessageBubble.jsx";

export default function ChatMessagesList({
  listRef,
  messages,
  myId,
  handleEditMessage,
  handleDeleteMessage,
}) {
  return (
    <div
      ref={listRef}
      className="chat-body"
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        overflowX: "hidden",
        padding: "14px 14px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        height: "100%",
      }}
    >
      {messages.length === 0 ? (
        <div
          className="chat-empty"
          style={{
            margin: "auto 0",
            textAlign: "center",
            opacity: 0.75,
            padding: "18px 12px",
          }}
        >
          No hay mensajes todavía.
        </div>
      ) : (
        messages.map((m) => (
          <ChatMessageBubble
            key={m._id || m.id || m.clientId}
            message={m}
            myId={myId}
            onEdit={handleEditMessage}
            onDelete={handleDeleteMessage}
          />
        ))
      )}
    </div>
  );
}