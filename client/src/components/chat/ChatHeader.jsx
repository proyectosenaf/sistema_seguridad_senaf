import React from "react";

const CloseIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

const BackIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

const UsersIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export default function ChatHeader({
  showContacts,
  setShowContacts,
  setOpen,
  isPrivateMode,
  selectedUser,
  getUserName,
}) {
  return (
    <div className="chat-header">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          minWidth: 0,
        }}
      >
        {showContacts ? (
          <button
            onClick={() => setShowContacts(false)}
            className="chat-header__close"
            aria-label="Ocultar usuarios"
            title="Ocultar usuarios"
          >
            <BackIcon />
          </button>
        ) : (
          <button
            onClick={() => setShowContacts((v) => !v)}
            className="chat-header__close"
            aria-label="Mostrar usuarios"
            title="Mostrar usuarios"
          >
            <UsersIcon />
          </button>
        )}

        <div
          className="chat-header__title"
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {isPrivateMode ? `Chat con ${getUserName(selectedUser)}` : "Chat general"}
        </div>
      </div>

      <button
        onClick={() => setOpen(false)}
        className="chat-header__close"
        aria-label="Cerrar chat"
        title="Cerrar"
      >
        <CloseIcon />
      </button>
    </div>
  );
}
