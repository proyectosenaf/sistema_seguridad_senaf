// client/src/components/ChatDock.jsx
import React from "react";
import api from "../lib/api.js";
import { socket } from "../lib/socket.js";
import { useAuth } from "./pages/auth/AuthProvider.jsx";
// ✅ auth local (sin Auth0)


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

/* Iniciales para avatar */
const initials = (name) =>
  (name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("") || "U";

function safeParseJson(raw, fallback) {
  try {
    if (!raw) return fallback;
    const v = JSON.parse(raw);
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
}

// Helper: id del usuario local (no Auth0)
function getMyId(user) {
  // Preferible: tu backend debe devolver user.id (string)
  return user?.id || user?._id || user?.email || null;
}

export default function ChatDock() {
  const bubbleSize = 60;
  const margin = 10;

  const panelW = 360;
  const panelH = 460;

  const { user, isAuthenticated } = useAuth();
  const myId = getMyId(user);

  const room = "global";

  const clampToViewport = React.useCallback(
    (x, y) => {
      const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
      const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

      const maxX = vw - bubbleSize - margin;
      const maxY = vh - bubbleSize - margin;

      return {
        x: Math.max(margin, Math.min(maxX, x)),
        y: Math.max(margin, Math.min(maxY, y)),
      };
    },
    [bubbleSize]
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

  // al montar: clamp por si cambió resolución
  React.useEffect(() => {
    setPos((p) => clampToViewport(p.x, p.y));
  }, [clampToViewport]);

  const [open, setOpen] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const [unread, setUnread] = React.useState(0);

  const [messages, setMessages] = React.useState([]);
  const [text, setText] = React.useState("");

  const btnRef = React.useRef(null);
  const listRef = React.useRef(null);

  const startRef = React.useRef({ x: 0, y: 0, px: 0, py: 0, moved: false });

  // resize: clamp posición
  React.useEffect(() => {
    const onResize = () => setPos((p) => clampToViewport(p.x, p.y));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clampToViewport]);

  // evento global para abrir el chat
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
      const next = clampToViewport(startRef.current.x + dx, startRef.current.y + dy);
      setPos(next);
    }
  };

  const onPointerUp = (e) => {
    try {
      btnRef.current?.releasePointerCapture?.(e.pointerId);
    } catch {}

    // Guardar la posición final (no la stale)
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
          // abrir: reset unread
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

  // 1) historial
  React.useEffect(() => {
    if (!isAuthenticated) return;
    let alive = true;

    (async () => {
      try {
        const { data } = await api.get("/chat/messages", { params: { room } });
        if (alive && Array.isArray(data)) setMessages(data);
      } catch (err) {
        console.error("[chat] GET /chat/messages", err?.response?.data || err?.message || err);
      }
    })();

    return () => {
      alive = false;
    };
  }, [isAuthenticated, room]);

  // 2) socket room
  React.useEffect(() => {
    if (!isAuthenticated) return;
    if (!socket) return;

    socket.emit("chat:join", { room });

    const onNew = (msg) => {
      setMessages((prev) => {
        const incomingId = msg?._id || msg?.id || null;
        const incomingClientId = msg?.clientId || null;

        if (incomingId && prev.some((m) => (m._id || m.id) === incomingId)) return prev;

        if (incomingClientId) {
          const idx = prev.findIndex((m) => m.clientId === incomingClientId);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = msg;
            return copy;
          }
        }
        return [...prev, msg];
      });
    };

    socket.on("chat:new", onNew);

    return () => {
      socket.off("chat:new", onNew);
      socket.emit("chat:leave", { room });
    };
  }, [isAuthenticated, room]);

  const send = async () => {
    const txt = text.trim();
    if (!txt) return;

    const tempId =
      (globalThis.crypto?.randomUUID && globalThis.crypto.randomUUID()) || String(Date.now());

    const displayName = user?.name || user?.nickname || user?.email || "Usuario";

    const optimistic = {
      _id: tempId,
      clientId: tempId,
      room,
      text: txt,
      user: myId ? { id: myId, name: displayName, email: user?.email } : undefined,
      createdAt: new Date().toISOString(),
      optimistic: true,
    };

    setMessages((m) => [...m, optimistic]);
    setText("");

    try {
      const { data } = await api.post("/chat/messages", {
        text: txt,
        room,
        clientId: tempId,
        userName: displayName,
        userEmail: user?.email || null,

        // ✅ nuevo (local)
        userId: myId,

        // compat legacy si tu backend lo usaba como “sub”
        userSub: myId,
      });

      setMessages((m) => m.map((msg) => (msg.clientId === tempId ? data : msg)));
    } catch (err) {
      console.error("[chat] POST /chat/messages", err?.response?.data || err?.message || err);
      setMessages((m) =>
        m.map((msg) => (msg.clientId === tempId ? { ...msg, error: true } : msg))
      );
    }
  };

  // autoscroll + unread (no contar si es mío)
  const prevCountRef = React.useRef(0);
  React.useEffect(() => {
    const prev = prevCountRef.current;
    prevCountRef.current = messages.length;

    const grew = messages.length > prev;
    if (!grew) return;

    const last = messages[messages.length - 1];

    // ✅ mine: compara id/email, no Auth0 sub
    const lastUserId = last?.user?.id || last?.user?._id || last?.user?.sub || last?.user?.email || null;
    const isMine = (lastUserId && myId && lastUserId === myId) || last?.optimistic === true;

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

  // calcular posición del panel usando viewport actual (no depender de layout)
  const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
  const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

  const openToLeft = pos.x > vw - (panelW + bubbleSize + 20);
  const openUp = pos.y > vh - (panelH + bubbleSize + 20);

  const panelLeft = openToLeft
    ? Math.max(8, pos.x - panelW - 12)
    : Math.min(pos.x + bubbleSize + 12, vw - panelW - 8);

  const panelTop = openUp
    ? Math.max(8, pos.y - panelH + bubbleSize)
    : Math.min(pos.y, vh - panelH - 8);

  // estilos mínimos inline para asegurar visibilidad aunque falte CSS
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
  };

  // Si no hay sesión, puedes ocultar el chat
  if (!isAuthenticated) return null;

  return (
    <>
      {open && (
        <div className="chat-panel" style={panelStyle}>
          <div className="chat-header">
            <div className="chat-header__title">Chat interno</div>
            <button
              onClick={() => setOpen(false)}
              className="chat-header__close"
              aria-label="Cerrar chat"
              title="Cerrar"
            >
              <CloseIcon />
            </button>
          </div>

          <div ref={listRef} className="chat-body">
            {messages.length === 0 ? (
              <div className="chat-empty">No hay mensajes todavía.</div>
            ) : (
              messages.map((m) => {
                const mUserId = m.user?.id || m.user?._id || m.user?.sub || m.user?.email || null;
                const mine = (mUserId && myId && mUserId === myId) || m.optimistic === true;

                const displayName = mine
                  ? "Tú"
                  : m.user?.name || m.user?.email || "Desconocido";

                return (
                  <div key={m._id || m.id || m.clientId} className={`chat-row ${mine ? "me" : ""}`}>
                    {!mine && (
                      <div className="chat-avatar" title={displayName}>
                        {initials(displayName)}
                      </div>
                    )}
                    <div className="chat-bubble">
                      <div className="chat-meta">{displayName}</div>
                      <div className={`chat-pill ${mine ? "me" : ""}`}>{m.text}</div>
                      <div className="chat-time">
                        {fmtDate(m.createdAt || m.at)}
                        {m.error ? " · ERROR" : ""}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="chat-input">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Escribe un mensaje…"
            />
            <button onClick={send} className="chat-send" disabled={!text.trim()}>
              Enviar
            </button>
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
