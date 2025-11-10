// client/src/modules/rondasqr/utils/outbox.js
// Maneja el almacenamiento local de checkins/alertas offline del guardia

const KEY = "rondasqr_outbox";

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

function save(list) {
  localStorage.setItem(KEY, JSON.stringify(list || []));
}

export function getOutbox() {
  return load();
}

export function queueCheckin(data) {
  const list = load();
  list.push({
    id: crypto.randomUUID(),
    ts: Date.now(),
    ...data,
  });
  save(list);
}

export function removeById(id) {
  const list = load().filter((x) => x.id !== id);
  save(list);
}

export function countOutbox() {
  return load().length;
}

export async function transmitOutbox(api) {
  const list = load();
  if (!list.length) return 0;

  let sent = 0;
  for (const item of list) {
    try {
      await api.post("/rondasqr/v1/offline/checkin", item);
      removeById(item.id);
      sent++;
    } catch (e) {
      console.warn("[outbox] Error enviando:", e.message);
    }
  }
  return sent;
}
