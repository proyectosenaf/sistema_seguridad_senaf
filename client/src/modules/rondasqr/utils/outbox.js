// Cola local para check-ins pendientes (offline / error de red)
const KEY = "rondasqr:outbox:v1";

function safeParse(s) {
  try { return JSON.parse(s); } catch { return []; }
}

export function getOutbox() {
  return safeParse(localStorage.getItem(KEY) || "[]");
}

export function saveOutbox(list) {
  localStorage.setItem(KEY, JSON.stringify(list || []));
}

export function countOutbox() {
  return getOutbox().length;
}

export function queueCheckin({ qr, gps = null, at }) {
  const item = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    qr,
    gps,
    at: at || Date.now(),
  };
  const list = getOutbox();
  list.push(item);
  saveOutbox(list);
  return item;
}

export function removeById(id) {
  saveOutbox(getOutbox().filter((x) => x.id !== id));
}

export function clearOutbox() {
  saveOutbox([]);
}

/**
 * Envia todos los pendientes usando la función `sendFn(item)`.
 * Devuelve { ok, fail, remaining } y deja en la cola SOLO los que fallaron.
 */
export async function transmitOutbox(sendFn) {
  const items = getOutbox();
  let ok = 0, fail = 0;
  const failed = [];
  for (const it of items) {
    try {
      await sendFn(it);
      ok++;
    } catch (e) {
      fail++;
      failed.push(it);
    }
  }
  saveOutbox(failed);
  return { ok, fail, remaining: failed.length };
}
