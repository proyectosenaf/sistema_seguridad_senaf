import React from "react";
import api from "../lib/api.js";
import { socket } from "../lib/socket.js";
import { useAuth } from "../pages/auth/AuthProvider.jsx";

/* === Iconos (SVG) === */
const ChatIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
  </svg>
);

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

const EmojiIcon = (props) => (
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
    <circle cx="12" cy="12" r="10" />
    <path d="M8 15s1.5 2 4 2 4-2 4-2" />
    <line x1="9" y1="9" x2="9.01" y2="9" />
    <line x1="15" y1="9" x2="15.01" y2="9" />
  </svg>
);

const initials = (name) =>
  (name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("") || "U";

const QUICK_EMOJIS = ["😀", "😂", "👍", "🙏", "🔥", "✅", "👀", "📌", "🎉", "😎"];

function safeParseJson(raw, fallback) {
  try {
    if (!raw) return fallback;
    const v = JSON.parse(raw);
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
}

function normText(v) {
  return String(v || "").trim();
}

function normString(v) {
  return String(v || "").trim();
}

function normRoleName(role) {
  if (!role) return "";
  if (typeof role === "string") return role.trim().toLowerCase();

  if (typeof role === "object") {
    return String(
      role.key ||
        role.code ||
        role.slug ||
        role.name ||
        role.nombre ||
        role.label ||
        ""
    )
      .trim()
      .toLowerCase();
  }

  return String(role).trim().toLowerCase();
}

function normalizeRoles(input) {
  const arr = Array.isArray(input) ? input : input ? [input] : [];
  return [...new Set(arr.map(normRoleName).filter(Boolean))];
}

function isVisitorUser(u) {
  const roles = normalizeRoles(
    u?.roles || u?.role || u?.user?.roles || u?.user?.role || []
  );

  return roles.some((r) =>
    ["visitante", "visitantes", "visita", "visitor", "visitors"].includes(r)
  );
}

function getIdentitySet(u) {
  const set = new Set();

  const values = [
    u?.id,
    u?._id,
    u?.sub,
    u?.userId,
    u?.uid,
    u?.email,
    u?.correo,
    u?.user?.id,
    u?.user?._id,
    u?.user?.sub,
    u?.user?.email,
  ];

  for (const value of values) {
    const s = String(value || "").trim();
    if (s) set.add(s);
    const e = String(value || "").trim().toLowerCase();
    if (e && e.includes("@")) set.add(e);
  }

  return set;
}

function isSameUser(a, b) {
  const A = getIdentitySet(a);
  const B = getIdentitySet(b);

  if (!A.size || !B.size) return false;

  for (const value of A) {
    if (B.has(value)) return true;
  }

  return false;
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

function getMyId(user) {
  return getUserId(user);
}

function getUserName(u) {
  return (
    u?.name ||
    u?.nombre ||
    u?.fullName ||
    u?.displayName ||
    u?.email ||
    "Usuario"
  );
}

function getUserEmail(u) {
  return u?.email || u?.correo || null;
}

function buildPrivateRoom(a, b) {
  const A = normString(a);
  const B = normString(b);
  if (!A || !B) return null;
  return `chat:private:${[A, B].sort((x, y) => x.localeCompare(y)).join("__")}`;
}

function isSeenByMe(message, myId) {
  if (!message || !Array.isArray(message.seenBy) || !myId) return false;
  return message.seenBy.some(
    (x) => String(x?.userId || "").trim() === String(myId).trim()
  );
}

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

export default function ChatDock() {
  const bubbleSize = 60;
  const margin = 10;

  const panelW = 380;
  const panelH = 520;

  const { user, isAuthenticated } = useAuth();
  const myId = getMyId(user);

  const clampToViewport = React.useCallback(
    (x, y) => {
      const vw = Math.max(
        document.documentElement.clientWidth,
        window.innerWidth || 0
      );
      const vh = Math.max(
        document.documentElement.clientHeight,
        window.innerHeight || 0
      );

      const maxX = vw - bubbleSize - margin;
      const maxY = vh - bubbleSize - margin;

      return {
        x: Math.max(margin, Math.min(maxX, x)),
        y: Math.max(margin, Math.min(maxY, y)),
      };
    },
    [bubbleSize, margin]
  );

  const [pos, setPos] = React.useState(() => {
    const saved = safeParseJson(localStorage.getItem("chatdock-pos"), null);
    const init =
      saved && typeof saved.x === "number" && typeof saved.y === "number"
        ? saved
        : {
            x: window.innerWidth - bubbleSize - 16,
            y: window.innerHeight - bubbleSize - 24,
          };
    return init;
  });

  React.useEffect(() => {
    setPos((p) => clampToViewport(p.x, p.y));
  }, [clampToViewport]);

  const [open, setOpen] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const [unread, setUnread] = React.useState(0);

  const [messages, setMessages] = React.useState([]);
  const [text, setText] = React.useState("");

  const [contacts, setContacts] = React.useState([]);
  const [contactsLoading, setContactsLoading] = React.useState(false);
  const [contactsError, setContactsError] = React.useState("");
  const [selectedUser, setSelectedUser] = React.useState(null);
  const [showContacts, setShowContacts] = React.useState(false);

  const [emojiOpen, setEmojiOpen] = React.useState(false);
  const [typingName, setTypingName] = React.useState("");
  const [onlineIds, setOnlineIds] = React.useState([]);
  const typingTimeoutRef = React.useRef(null);

  const btnRef = React.useRef(null);
  const listRef = React.useRef(null);
  const inputRef = React.useRef(null);
  const startRef = React.useRef({ x: 0, y: 0, px: 0, py: 0, moved: false });

  const selectedUserId = getUserId(selectedUser);
  const isPrivateMode = !!selectedUserId && !!myId;
  const currentRoom = isPrivateMode
    ? buildPrivateRoom(myId, selectedUserId)
    : "global";

  React.useEffect(() => {
    const onResize = () => setPos((p) => clampToViewport(p.x, p.y));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clampToViewport]);

  React.useEffect(() => {
    const openHandler = () => setOpen(true);
    window.addEventListener("chat:open", openHandler);
    return () => window.removeEventListener("chat:open", openHandler);
  }, []);

  const onPointerDown = (e) => {
    e.preventDefault();
    btnRef.current?.setPointerCapture?.(e.pointerId);
    startRef.current = {
      x: pos.x,
      y: pos.y,
      px: e.clientX,
      py: e.clientY,
      moved: false,
    };
  };

  const onPointerMove = (e) => {
    if (!btnRef.current?.hasPointerCapture?.(e.pointerId)) return;

    const dx = e.clientX - startRef.current.px;
    const dy = e.clientY - startRef.current.py;

    if (!startRef.current.moved && Math.hypot(dx, dy) > 4) {
      startRef.current.moved = true;
      setDragging(true);
    }

    if (startRef.current.moved) {
      const next = clampToViewport(
        startRef.current.x + dx,
        startRef.current.y + dy
      );
      setPos(next);
    }
  };

  const onPointerUp = (e) => {
    try {
      btnRef.current?.releasePointerCapture?.(e.pointerId);
    } catch {}

    setPos((current) => {
      try {
        localStorage.setItem("chatdock-pos", JSON.stringify(current));
      } catch {}
      return current;
    });

    if (!startRef.current.moved) {
      setOpen((v) => {
        const next = !v;
        if (next) {
          setUnread(0);
          setTimeout(() => {
            listRef.current?.scrollTo({
              top: listRef.current.scrollHeight,
              behavior: "auto",
            });
          }, 0);
        }
        return next;
      });
    }

    setDragging(false);
  };

  React.useEffect(() => {
    if (!isAuthenticated || !open) return;

    let alive = true;
    setContactsLoading(true);
    setContactsError("");

    (async () => {
      const attempts = [
        "/api/iam/v1/users",
        "/iam/v1/users",
        "/api/iam/users",
        "/iam/users",
      ];

      for (const url of attempts) {
        try {
          const { data } = await api.get(url);

          const raw = Array.isArray(data)
            ? data
            : Array.isArray(data?.items)
            ? data.items
            : Array.isArray(data?.rows)
            ? data.rows
            : Array.isArray(data?.data)
            ? data.data
            : [];

          const filtered = raw
            .filter(Boolean)
            .filter((u) => !isVisitorUser(u))
            .filter((u) => !isSameUser(u, user));

          if (alive) {
            setContacts(filtered);
            setContactsError("");
            setContactsLoading(false);
          }
          return;
        } catch {
          continue;
        }
      }

      if (alive) {
        setContacts([]);
        setContactsError("No se pudo cargar la lista de usuarios.");
        setContactsLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [isAuthenticated, open, user]);

  React.useEffect(() => {
    if (!selectedUser) return;

    const stillExists = contacts.some((u) => isSameUser(u, selectedUser));
    if (!stillExists) {
      setSelectedUser(null);
    }
  }, [contacts, selectedUser]);

  React.useEffect(() => {
    if (!isAuthenticated) return;
    if (!currentRoom) return;

    let alive = true;

    (async () => {
      try {
        const { data } = await api.get("/chat/messages", {
          params: { room: currentRoom },
        });

        if (alive && Array.isArray(data)) setMessages(data);
        else if (alive) setMessages([]);
      } catch (err) {
        console.error(
          "[chat] GET /chat/messages",
          err?.response?.data || err?.message || err
        );
        if (alive) setMessages([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, [isAuthenticated, currentRoom]);

  React.useEffect(() => {
    if (!isAuthenticated || !socket || !myId) return;

    socket.emit("presence:online", { userId: myId });

    const onPresenceOnline = ({ userId }) => {
      if (!userId) return;
      setOnlineIds((prev) =>
        prev.includes(userId) ? prev : [...prev, userId]
      );
    };

    const onPresenceOffline = ({ userId }) => {
      if (!userId) return;
      setOnlineIds((prev) => prev.filter((id) => id !== userId));
    };

    socket.on("presence:online", onPresenceOnline);
    socket.on("presence:offline", onPresenceOffline);

    return () => {
      socket.emit("presence:offline", { userId: myId });
      socket.off("presence:online", onPresenceOnline);
      socket.off("presence:offline", onPresenceOffline);
    };
  }, [isAuthenticated, myId]);

  React.useEffect(() => {
    if (!isAuthenticated || !socket || !currentRoom) return;

    const applyIncoming = (prev, msg, markOptimisticFalse = false) => {
      const incomingId = msg?._id || msg?.id || null;
      const incomingClientId = msg?.clientId || null;

      if (incomingId && prev.some((m) => (m._id || m.id) === incomingId)) {
        return prev.map((m) =>
          (m._id || m.id) === incomingId && markOptimisticFalse
            ? { ...m, ...msg, optimistic: false }
            : m
        );
      }

      if (incomingClientId) {
        const idx = prev.findIndex((m) => m.clientId === incomingClientId);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = markOptimisticFalse
            ? { ...copy[idx], ...msg, optimistic: false }
            : { ...copy[idx], ...msg };
          return copy;
        }
      }

      return [...prev, msg];
    };

    if (isPrivateMode) {
      socket.emit("chat:private:join", {
        fromUserId: myId,
        toUserId: selectedUserId,
      });

      const onPrivateNew = (msg) => {
        if (!msg) return;
        if (msg.room !== currentRoom) return;
        setMessages((prev) => applyIncoming(prev, msg, true));
      };

      const onTyping = ({ room, userId, name }) => {
        if (room !== currentRoom) return;
        if (!userId || String(userId) === String(myId)) return;
        setTypingName(name || "Escribiendo...");
      };

      const onStopTyping = ({ room, userId }) => {
        if (room !== currentRoom) return;
        if (!userId || String(userId) === String(myId)) return;
        setTypingName("");
      };

      const onUpdate = (msg) => {
        if (!msg || msg.room !== currentRoom) return;
        setMessages((prev) => prev.map((m) => (m._id === msg._id ? msg : m)));
      };

      const onDelete = (msg) => {
        if (!msg || msg.room !== currentRoom) return;
        setMessages((prev) => prev.map((m) => (m._id === msg._id ? msg : m)));
      };

      const onSeen = (payload) => {
        if (!payload?._id) return;
        setMessages((prev) =>
          prev.map((m) => {
            if (String(m._id) !== String(payload._id)) return m;
            const seenBy = Array.isArray(m.seenBy) ? [...m.seenBy] : [];
            const exists = seenBy.some(
              (x) =>
                String(x?.userId || "").trim() ===
                String(payload.userId || "").trim()
            );
            if (!exists && payload.userId) {
              seenBy.push({
                userId: payload.userId,
                seenAt: new Date().toISOString(),
              });
            }
            if (Array.isArray(payload.seenBy)) {
              return { ...m, seenBy: payload.seenBy };
            }
            return { ...m, seenBy };
          })
        );
      };

      socket.on("chat:private:new", onPrivateNew);
      socket.on("chat:typing", onTyping);
      socket.on("chat:stopTyping", onStopTyping);
      socket.on("chat:update", onUpdate);
      socket.on("chat:delete", onDelete);
      socket.on("chat:seen", onSeen);

      return () => {
        socket.off("chat:private:new", onPrivateNew);
        socket.off("chat:typing", onTyping);
        socket.off("chat:stopTyping", onStopTyping);
        socket.off("chat:update", onUpdate);
        socket.off("chat:delete", onDelete);
        socket.off("chat:seen", onSeen);
        socket.emit("chat:private:leave", {
          fromUserId: myId,
          toUserId: selectedUserId,
          room: currentRoom,
        });
      };
    }

    socket.emit("chat:join", { room: currentRoom });

    const onNew = (msg) => {
      setMessages((prev) => applyIncoming(prev, msg, false));
    };

    const onTyping = ({ room, userId, name }) => {
      if (room !== currentRoom) return;
      if (!userId || String(userId) === String(myId)) return;
      setTypingName(name || "Escribiendo...");
    };

    const onStopTyping = ({ room, userId }) => {
      if (room !== currentRoom) return;
      if (!userId || String(userId) === String(myId)) return;
      setTypingName("");
    };

    const onUpdate = (msg) => {
      if (!msg || msg.room !== currentRoom) return;
      setMessages((prev) => prev.map((m) => (m._id === msg._id ? msg : m)));
    };

    const onDelete = (msg) => {
      if (!msg || msg.room !== currentRoom) return;
      setMessages((prev) => prev.map((m) => (m._id === msg._id ? msg : m)));
    };

    const onSeen = (payload) => {
      if (!payload?._id) return;
      setMessages((prev) =>
        prev.map((m) => {
          if (String(m._id) !== String(payload._id)) return m;
          const seenBy = Array.isArray(m.seenBy) ? [...m.seenBy] : [];
          const exists = seenBy.some(
            (x) =>
              String(x?.userId || "").trim() ===
              String(payload.userId || "").trim()
          );
          if (!exists && payload.userId) {
            seenBy.push({
              userId: payload.userId,
              seenAt: new Date().toISOString(),
            });
          }
          if (Array.isArray(payload.seenBy)) {
            return { ...m, seenBy: payload.seenBy };
          }
          return { ...m, seenBy };
        })
      );
    };

    socket.on("chat:new", onNew);
    socket.on("chat:typing", onTyping);
    socket.on("chat:stopTyping", onStopTyping);
    socket.on("chat:update", onUpdate);
    socket.on("chat:delete", onDelete);
    socket.on("chat:seen", onSeen);

    return () => {
      socket.off("chat:new", onNew);
      socket.off("chat:typing", onTyping);
      socket.off("chat:stopTyping", onStopTyping);
      socket.off("chat:update", onUpdate);
      socket.off("chat:delete", onDelete);
      socket.off("chat:seen", onSeen);
      socket.emit("chat:leave", { room: currentRoom });
    };
  }, [isAuthenticated, currentRoom, isPrivateMode, myId, selectedUserId]);

  React.useEffect(() => {
    if (!open || !messages.length || !myId) return;

    const unreadSeenTargets = messages.filter((m) => {
      const ownerId =
        m?.user?.id || m?.user?._id || m?.user?.sub || m?.user?.email || null;
      const mine = ownerId && myId && String(ownerId) === String(myId);
      if (mine) return false;
      if (!m?._id) return false;
      return !isSeenByMe(m, myId);
    });

    unreadSeenTargets.forEach((m) => {
      socket.emit("chat:seen", {
        room: currentRoom,
        messageId: m._id,
        userId: myId,
      });

      api
        .post(`/chat/messages/${m._id}/seen`, {
          userId: myId,
          userSub: myId,
        })
        .catch(() => {});
    });
  }, [open, messages, currentRoom, myId]);

  const emitTyping = React.useCallback(() => {
    if (!socket || !currentRoom || !myId) return;

    socket.emit("chat:typing", {
      room: currentRoom,
      userId: myId,
      name: user?.name || user?.email || "Usuario",
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("chat:stopTyping", {
        room: currentRoom,
        userId: myId,
      });
    }, 1000);
  }, [currentRoom, myId, user]);

  const send = async () => {
    const txt = normText(text);
    if (!txt) return;

    const tempId =
      (globalThis.crypto?.randomUUID && globalThis.crypto.randomUUID()) ||
      String(Date.now());

    const displayName = user?.name || user?.nickname || user?.email || "Usuario";

    const optimistic = {
      _id: tempId,
      clientId: tempId,
      room: currentRoom,
      text: txt,
      type: "text",
      user: myId
        ? {
            id: myId,
            sub: myId,
            name: displayName,
            email: user?.email || null,
          }
        : undefined,
      createdAt: new Date().toISOString(),
      optimistic: true,
      seenBy: [],
    };

    setMessages((m) => [...m, optimistic]);
    setText("");
    setEmojiOpen(false);

    if (socket) {
      socket.emit("chat:stopTyping", {
        room: currentRoom,
        userId: myId,
      });
    }

    if (isPrivateMode) {
      try {
        const payload = {
          _id: tempId,
          clientId: tempId,
          room: currentRoom,
          text: txt,
          type: "text",
          user: optimistic.user,
          createdAt: optimistic.createdAt,
          fromUserId: myId,
          toUserId: selectedUserId,
          seenBy: [],
        };

        socket.emit("chat:private:send", payload, (ack) => {
          if (ack?.ok) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.clientId === tempId
                  ? {
                      ...msg,
                      optimistic: false,
                    }
                  : msg
              )
            );
          } else {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.clientId === tempId ? { ...msg, error: true } : msg
              )
            );
          }
        });
      } catch (err) {
        console.error(
          "[chat] private send",
          err?.response?.data || err?.message || err
        );
        setMessages((m) =>
          m.map((msg) =>
            msg.clientId === tempId ? { ...msg, error: true } : msg
          )
        );
      }
      return;
    }

    try {
      const { data } = await api.post("/chat/messages", {
        text: txt,
        room: currentRoom,
        clientId: tempId,
        type: "text",
        userName: displayName,
        userEmail: user?.email || null,
        userId: myId,
        userSub: myId,
      });

      setMessages((m) =>
        m.map((msg) => (msg.clientId === tempId ? data : msg))
      );
    } catch (err) {
      console.error(
        "[chat] POST /chat/messages",
        err?.response?.data || err?.message || err
      );
      setMessages((m) =>
        m.map((msg) =>
          msg.clientId === tempId ? { ...msg, error: true } : msg
        )
      );
    }
  };

  const handleEditMessage = async (message) => {
    if (!message?._id || message?.deleted) return;

    const nuevo = window.prompt("Editar mensaje:", message.text || "");
    const clean = normText(nuevo);
    if (!clean || clean === normText(message.text)) return;

    try {
      const { data } = await api.put(`/chat/messages/${message._id}`, {
        text: clean,
        userId: myId,
        userSub: myId,
        userEmail: user?.email || null,
      });

      setMessages((prev) =>
        prev.map((m) => (String(m._id) === String(data._id) ? data : m))
      );

      socket.emit("chat:edit", {
        room: currentRoom,
        message: data,
      });
    } catch (err) {
      console.error(
        "[chat] PUT /chat/messages/:id",
        err?.response?.data || err?.message || err
      );
      window.alert("No se pudo editar el mensaje.");
    }
  };

  const handleDeleteMessage = async (message) => {
    if (!message?._id || message?.deleted) return;
    const ok = window.confirm("¿Eliminar mensaje?");
    if (!ok) return;

    try {
      const { data } = await api.delete(`/chat/messages/${message._id}`, {
        data: {
          userId: myId,
          userSub: myId,
          userEmail: user?.email || null,
        },
      });

      const deletedMsg = data?.message || null;
      if (deletedMsg?._id) {
        setMessages((prev) =>
          prev.map((m) =>
            String(m._id) === String(deletedMsg._id) ? deletedMsg : m
          )
        );

        socket.emit("chat:delete", {
          room: currentRoom,
          message: deletedMsg,
        });
      }
    } catch (err) {
      console.error(
        "[chat] DELETE /chat/messages/:id",
        err?.response?.data || err?.message || err
      );
      window.alert("No se pudo eliminar el mensaje.");
    }
  };

  const prevCountRef = React.useRef(0);
  React.useEffect(() => {
    const prev = prevCountRef.current;
    prevCountRef.current = messages.length;

    const grew = messages.length > prev;
    if (!grew) return;

    const last = messages[messages.length - 1];
    const lastUserId =
      last?.user?.id ||
      last?.user?._id ||
      last?.user?.sub ||
      last?.user?.email ||
      null;

    const isMine =
      (lastUserId && myId && String(lastUserId) === String(myId)) ||
      last?.optimistic === true;

    if (open) {
      listRef.current?.scrollTo({
        top: listRef.current.scrollHeight,
        behavior: "smooth",
      });
    } else if (!isMine) {
      setUnread((u) => u + 1);
    }
  }, [messages, open, myId]);

  const fmtDate = (v) => {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString();
  };

  const vw = Math.max(
    document.documentElement.clientWidth,
    window.innerWidth || 0
  );
  const vh = Math.max(
    document.documentElement.clientHeight,
    window.innerHeight || 0
  );

  const openToLeft = pos.x > vw - (panelW + bubbleSize + 20);
  const openUp = pos.y > vh - (panelH + bubbleSize + 20);

  const panelLeft = openToLeft
    ? Math.max(8, pos.x - panelW - 12)
    : Math.min(pos.x + bubbleSize + 12, vw - panelW - 8);

  const panelTop = openUp
    ? Math.max(8, pos.y - panelH + bubbleSize)
    : Math.min(pos.y, vh - panelH - 8);

  const fabStyle = {
    position: "fixed",
    left: pos.x,
    top: pos.y,
    width: bubbleSize,
    height: bubbleSize,
    zIndex: 9999,
    pointerEvents: "auto",
  };

  const panelStyle = {
    position: "fixed",
    left: panelLeft,
    top: panelTop,
    width: panelW,
    height: panelH,
    zIndex: 9999,
    pointerEvents: "auto",
    display: "grid",
    gridTemplateColumns: showContacts ? "132px 1fr" : "1fr",
    overflow: "hidden",
  };

  if (!isAuthenticated) return null;

  return (
    <>
      {open && (
        <div className="chat-panel" style={panelStyle}>
          {showContacts && (
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
                  borderBottom:
                    "1px solid var(--border, rgba(255,255,255,.08))",
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
                  background: selectedUser
                    ? "transparent"
                    : "rgba(59,130,246,.14)",
                  color: "inherit",
                  padding: "10px 12px",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                Chat global
              </button>

              <div
                style={{
                  overflowY: "auto",
                  flex: 1,
                }}
              >
                {contactsLoading ? (
                  <div style={{ padding: 12, fontSize: 12, opacity: 0.8 }}>
                    Cargando...
                  </div>
                ) : contactsError ? (
                  <div style={{ padding: 12, fontSize: 12, opacity: 0.8 }}>
                    {contactsError}
                  </div>
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
                          background: active
                            ? "rgba(59,130,246,.14)"
                            : "transparent",
                          color: "inherit",
                          padding: "10px 12px",
                          cursor: "pointer",
                          borderBottom:
                            "1px solid var(--border, rgba(255,255,255,.05))",
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
                        <div style={{ fontSize: 11, opacity: 0.7 }}>
                          {getUserEmail(u) || uid}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          <div
            style={{
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              position: "relative",
            }}
          >
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
                  {isPrivateMode
                    ? `Chat con ${getUserName(selectedUser)}`
                    : "Chat interno"}
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

            <div
              style={{
                minHeight: 20,
                padding: typingName ? "4px 12px 0" : "0 12px",
                fontSize: 12,
                opacity: 0.75,
              }}
            >
              {typingName ? `${typingName} está escribiendo...` : ""}
            </div>

            <div ref={listRef} className="chat-body">
              {messages.length === 0 ? (
                <div className="chat-empty">
                  {isPrivateMode
                    ? "No hay mensajes con este usuario todavía."
                    : "No hay mensajes todavía."}
                </div>
              ) : (
                messages.map((m) => {
                  const mUserId =
                    m.user?.id ||
                    m.user?._id ||
                    m.user?.sub ||
                    m.user?.email ||
                    null;

                  const mine =
                    (mUserId && myId && String(mUserId) === String(myId)) ||
                    m.optimistic === true;

                  const displayName = mine
                    ? "Tú"
                    : m.user?.name || m.user?.email || "Desconocido";

                  const seenCount = Array.isArray(m.seenBy) ? m.seenBy.length : 0;

                  return (
                    <div
                      key={m._id || m.id || m.clientId}
                      className={`chat-row ${mine ? "me" : ""}`}
                    >
                      {!mine && (
                        <div className="chat-avatar" title={displayName}>
                          {initials(displayName)}
                        </div>
                      )}

                      <div className="chat-bubble">
                        <div className="chat-meta">{displayName}</div>

                        <div className={`chat-pill ${mine ? "me" : ""}`}>
                          {renderMessageContent(m)}
                        </div>

                        <div className="chat-time">
                          {fmtDate(m.createdAt || m.at)}
                          {m.edited ? " · editado" : ""}
                          {m.error ? " · ERROR" : ""}
                          {m.optimistic ? " · ENVIANDO..." : ""}
                          {mine && !m.deleted ? ` · ${seenCount > 0 ? "✔✔" : "✔"}` : ""}
                        </div>

                        {mine && !m.deleted && (
                          <div
                            style={{
                              marginTop: 4,
                              display: "flex",
                              gap: 6,
                              justifyContent: "flex-end",
                            }}
                          >
                            {String(m.type || "text") === "text" && (
                              <button
                                type="button"
                                style={{ fontSize: 11 }}
                                onClick={() => handleEditMessage(m)}
                              >
                                ✏️ Editar
                              </button>
                            )}

                            <button
                              type="button"
                              style={{ fontSize: 11 }}
                              onClick={() => handleDeleteMessage(m)}
                            >
                              🗑️ Eliminar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {emojiOpen && (
              <div
                style={{
                  position: "absolute",
                  left: 12,
                  bottom: 68,
                  background: "var(--card, rgba(17,24,39,.96))",
                  border: "1px solid var(--border, rgba(255,255,255,.08))",
                  borderRadius: 14,
                  padding: 10,
                  display: "grid",
                  gridTemplateColumns: "repeat(5, 1fr)",
                  gap: 8,
                  zIndex: 10000,
                }}
              >
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      setText((prev) => `${prev}${emoji}`);
                      inputRef.current?.focus();
                    }}
                    style={{
                      border: "none",
                      background: "transparent",
                      fontSize: 20,
                      cursor: "pointer",
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            <div className="chat-input">
              <button
                type="button"
                onClick={() => setEmojiOpen((v) => !v)}
                className="chat-header__close"
                aria-label="Emojis"
                title="Emojis"
              >
                <EmojiIcon />
              </button>

              <input
                ref={inputRef}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  emitTyping();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") send();
                }}
                placeholder={
                  isPrivateMode
                    ? `Mensaje para ${getUserName(selectedUser)}…`
                    : "Escribe un mensaje…"
                }
              />

              <button
                onClick={send}
                className="chat-send"
                disabled={!text.trim()}
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        ref={btnRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className={`chat-fab ${dragging ? "dragging" : ""}`}
        style={fabStyle}
        aria-label="Abrir chat interno"
        title="Chat"
      >
        <div className="chat-fab__glow" aria-hidden />
        <ChatIcon />
        {unread > 0 && !open && (
          <span className="chat-badge">{unread > 9 ? "9+" : unread}</span>
        )}
      </button>
    </>
  );
}