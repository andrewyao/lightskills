const RETRYABLE = new Set([429, 502, 503]);

export async function fetchJson(url, { maxAttempts = 3, baseDelayMs = 200 } = {}) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    if (!RETRYABLE.has(res.status) || attempt >= maxAttempts) {
      throw new Error(`HTTP ${res.status} after ${attempt} attempt(s)`);
    }
    await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** (attempt - 1)));
  }
}
