const store = new Map();
const TTL_MS = 60_000;

export function get(key, now = Date.now()) {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (now - entry.at > TTL_MS) {
    store.delete(key);
    return undefined;
  }
  return entry.value;
}

export function set(key, value, now = Date.now()) {
  store.set(key, { value, at: now });
}
