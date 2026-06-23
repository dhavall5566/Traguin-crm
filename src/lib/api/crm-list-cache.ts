import type { PaginatedResponse } from "@/lib/api/pagination";

const CACHE = new Map<string, { data: unknown; ts: number }>();

/** How long cached CRM list pages stay fresh before a background revalidate. */
export const CRM_LIST_CACHE_TTL_MS = 180_000;

export function crmListPageCacheKey(prefix: string, offset: number, limit: number): string {
  return `${prefix}:${offset}:${limit}`;
}

export function peekCrmListCache<T>(key: string, maxAgeMs = CRM_LIST_CACHE_TTL_MS): T | null {
  const entry = CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > maxAgeMs) return null;
  return entry.data as T;
}

export function setCrmListCache(key: string, data: unknown): void {
  CACHE.set(key, { data, ts: Date.now() });
}

export function invalidateCrmListCache(prefix?: string): void {
  if (!prefix) {
    CACHE.clear();
    return;
  }
  for (const key of CACHE.keys()) {
    if (key.startsWith(`${prefix}:`)) {
      CACHE.delete(key);
    }
  }
}

/**
 * Return cached page immediately when available; revalidate in the background.
 */
export async function fetchCrmListPageCached<T>(
  cacheKey: string,
  fetcher: () => Promise<PaginatedResponse<T>>,
  options?: { force?: boolean },
): Promise<PaginatedResponse<T>> {
  if (!options?.force) {
    const cached = peekCrmListCache<PaginatedResponse<T>>(cacheKey);
    if (cached) {
      void fetcher()
        .then((fresh) => setCrmListCache(cacheKey, fresh))
        .catch(() => undefined);
      return cached;
    }
  }

  const data = await fetcher();
  setCrmListCache(cacheKey, data);
  return data;
}
