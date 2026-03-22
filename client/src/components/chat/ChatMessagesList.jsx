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
    <div ref={listRef} className="chat-body">
      {messages.length === 0 ? (
        <div className="chat-empty">No hay mensajes todavía.</div>
      ) : (
        messages.map((m) => {
          const mUserId =
            m.user?.id || m.user?._id || m.user?.sub || m.user?.email || null;

          const mine =
            (mUserId && myId && String(mUserId) === String(myId)) ||
            m.optimistic === true;

          return (
            <ChatMessageBubble
              key={m._id || m.id || m.clientId}
              message={m}
              mine={mine}
              onEdit={handleEditMessage}
              onDelete={handleDeleteMessage}
            />
          );
        })
      )}
    </div>
  );
}
