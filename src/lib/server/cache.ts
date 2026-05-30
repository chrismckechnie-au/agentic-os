import "server-only";

type CacheEntry<T> = {
  expiresAt: number;
  fingerprint?: string;
  value: T;
};

const STORE_KEY = "__agentic_os_server_cache__";

function getStore(): Map<string, CacheEntry<unknown>> {
  const globalStore = globalThis as typeof globalThis & {
    [STORE_KEY]?: Map<string, CacheEntry<unknown>>;
  };

  if (!globalStore[STORE_KEY]) {
    globalStore[STORE_KEY] = new Map<string, CacheEntry<unknown>>();
  }

  return globalStore[STORE_KEY];
}

export function readThroughCache<T>(
  key: string,
  ttlMs: number,
  load: () => T,
  fingerprint?: string,
): T {
  const store = getStore();
  const now = Date.now();
  const entry = store.get(key) as CacheEntry<T> | undefined;

  if (
    entry &&
    entry.expiresAt > now &&
    (fingerprint === undefined || entry.fingerprint === fingerprint)
  ) {
    return entry.value;
  }

  const value = load();
  store.set(key, {
    expiresAt: now + ttlMs,
    fingerprint,
    value,
  });
  return value;
}
