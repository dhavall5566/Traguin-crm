import type { Agency, User } from "@/lib/store";

const SESSION_CACHE_KEY = "travelcrm-session-cache";
const SESSION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type CachedSession = {
  user: User;
  agency: Agency;
  cachedAt: number;
};

export function readSessionCache(): CachedSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSession;
    if (!parsed.user?.id || !parsed.agency?.id) return null;
    if (Date.now() - parsed.cachedAt > SESSION_CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSessionCache(user: User, agency: Agency): void {
  if (typeof window === "undefined") return;
  try {
    const payload: CachedSession = { user, agency, cachedAt: Date.now() };
    sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearSessionCache(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(SESSION_CACHE_KEY);
  } catch {
    /* ignore */
  }
}
