import { fetchJson } from './fetch.js';
import * as cache from './cache.js';

const inflight = new Map();

export async function getUser(userId) {
  const hit = cache.get(userId);
  if (hit !== undefined) return hit;
  if (inflight.has(userId)) return inflight.get(userId);
  const p = fetchJson(`/users/${userId}`)
    .then((user) => {
      cache.set(userId, user);
      return user;
    })
    .finally(() => inflight.delete(userId));
  inflight.set(userId, p);
  return p;
}
