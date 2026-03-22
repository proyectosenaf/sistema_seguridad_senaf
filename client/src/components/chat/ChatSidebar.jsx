import React from "react";

export default function ChatSidebar({
  contacts,
  contactsLoading,
  contactsError,
  selectedUser,
  setSelectedUser,
  setShowContacts,
  onlineIds,
  getUserId,
  getUserName,
  getUserEmail,
  isSameUser,
}) {
  return (
    <div
      className="chat-sidebar"
      style={{
        borderRight: "1px solid var(--border, rgba(255,255,255,.08))",
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        background: "var(--card, rgba(17,24,39,.9))",
      }}
    >
      <div
        style={{
          padding: "10px 12px",
          borderBottom: "1px solid var(--border, rgba(255,255,255,.08))",
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        Usuarios
      </div>

      <button
        type="button"
        onClick={() => {
          setSelectedUser(null);
          setShowContacts(false);
        }}
        style={{
          textAlign: "left",
          border: "none",
          background: selectedUser ? "transparent" : "rgba(59,130,246,.14)",
          color: "inherit",
          padding: "10px 12px",
          cursor: "pointer",
          fontSize: 13,
        }}
      >
        Chat privados
      </button>

      <div style={{ overflowY: "auto", flex: 1 }}>
        {contactsLoading ? (
          <div style={{ padding: 12, fontSize: 12, opacity: 0.8 }}>Cargando...</div>
        ) : contactsError ? (
          <div style={{ padding: 12, fontSize: 12, opacity: 0.8 }}>{contactsError}</div>
        ) : contacts.length === 0 ? (
          <div style={{ padding: 12, fontSize: 12, opacity: 0.8 }}>
            Sin usuarios disponibles
          </div>
        ) : (
          contacts.map((u) => {
            const uid = getUserId(u);
            const uname = getUserName(u);
            const active = selectedUser && isSameUser(u, selectedUser);
            const online = onlineIds.includes(uid);

            return (
              <button
                key={uid}
                type="button"
                onClick={() => {
                  setSelectedUser(u);
                  setShowContacts(false);
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  border: "none",
                  background: active ? "rgba(59,130,246,.14)" : "transparent",
                  color: "inherit",
                  padding: "10px 12px",
                  cursor: "pointer",
                  borderBottom: "1px solid var(--border, rgba(255,255,255,.05))",
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span>{uname}</span>
                  <span
                    title={online ? "En línea" : "Sin conexión"}
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "999px",
                      display: "inline-block",
                      background: online ? "#22c55e" : "#64748b",
                    }}
                  />
                </div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>{getUserEmail(u) || uid}</div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
