/** Track landmark phrases so they are not repeated across itinerary days. */

export function splitPlacesList(text: string): string[] {
  return text
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function normalizePlaceKey(place: string): string {
  return place.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function isPlaceUsed(place: string, used: ReadonlySet<string>): boolean {
  const key = normalizePlaceKey(place);
  if (!key) return true;
  if (used.has(key)) return true;
  for (const seen of used) {
    if (key.includes(seen) || seen.includes(key)) return true;
  }
  return false;
}

export function dedupePlacesCsv(places: string, used: Set<string>): string {
  const kept: string[] = [];
  for (const part of splitPlacesList(places)) {
    if (isPlaceUsed(part, used)) continue;
    used.add(normalizePlaceKey(part));
    kept.push(part);
  }
  return kept.join(', ');
}

export function registerPlacesCsv(places: string, used: Set<string>): void {
  for (const part of splitPlacesList(places)) {
    const key = normalizePlaceKey(part);
    if (key) used.add(key);
  }
}

export class PlaceUsageTracker {
  private readonly used = new Set<string>();

  dedupe(places: string): string {
    return dedupePlacesCsv(places, this.used);
  }

  register(places: string): void {
    registerPlacesCsv(places, this.used);
  }

  pickFresh(pool: readonly string[], count: number): string {
    const kept: string[] = [];
    for (const part of pool) {
      if (kept.length >= count) break;
      if (isPlaceUsed(part, this.used)) continue;
      this.used.add(normalizePlaceKey(part));
      kept.push(part);
    }
    return kept.join(', ');
  }

  get usedKeys(): ReadonlySet<string> {
    return this.used;
  }
}
