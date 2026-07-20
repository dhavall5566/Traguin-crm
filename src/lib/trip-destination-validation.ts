/** Validate that AI itineraries target real cities, states, or countries. */

const NON_PLACE_TERMS = new Set([
  'total',
  'toatl',
  'price',
  'pricing',
  'budget',
  'trip',
  'tour',
  'package',
  'itinerary',
  'hotel',
  'day',
  'days',
  'night',
  'nights',
  'family',
  'balanced',
  'luxury',
  'adventure',
]);

/** Countries, states, and well-known cities — supplement CMS catalog. */
const WORLD_PLACES = [
  'Afghanistan',
  'Albania',
  'Algeria',
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Argentina',
  'Armenia',
  'Assam',
  'Australia',
  'Austria',
  'Ahmedabad',
  'Bali',
  'Bangalore',
  'Bangkok',
  'Belgium',
  'Bengaluru',
  'Bhutan',
  'Bihar',
  'Brazil',
  'Cambodia',
  'Canada',
  'Chennai',
  'Chhattisgarh',
  'China',
  'Colombia',
  'Croatia',
  'Czech Republic',
  'Delhi',
  'Denmark',
  'Dubai',
  'Egypt',
  'Finland',
  'France',
  'Goa',
  'Greece',
  'Gujarat',
  'Germany',
  'Himachal Pradesh',
  'Hong Kong',
  'Hungary',
  'Hyderabad',
  'Iceland',
  'India',
  'Indonesia',
  'Ireland',
  'Israel',
  'Italy',
  'Jaipur',
  'Japan',
  'Jammu and Kashmir',
  'Karnataka',
  'Kerala',
  'Kenya',
  'Kolkata',
  'Ladakh',
  'Lakshadweep',
  'London',
  'Madhya Pradesh',
  'Maharashtra',
  'Malaysia',
  'Maldives',
  'Manali',
  'Mauritius',
  'Mexico',
  'Mumbai',
  'Mysuru',
  'Nepal',
  'Netherlands',
  'New Zealand',
  'Norway',
  'Oman',
  'Paris',
  'Philippines',
  'Poland',
  'Portugal',
  'Punjab',
  'Qatar',
  'Rajasthan',
  'Rome',
  'Russia',
  'Sikkim',
  'Singapore',
  'South Africa',
  'South Korea',
  'Spain',
  'Sri Lanka',
  'Switzerland',
  'Tamil Nadu',
  'Telangana',
  'Thailand',
  'Turkey',
  'Udaipur',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
  'Uttar Pradesh',
  'Uttarakhand',
  'Varanasi',
  'Vietnam',
  'West Bengal',
];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function catalogPlaceNames(destinations: { name: string }[]): string[] {
  return destinations.map((row) => row.name.trim()).filter(Boolean);
}

function allPlaceCandidates(destinations: { name: string }[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const name of [...catalogPlaceNames(destinations), ...WORLD_PLACES]) {
    const key = normalizeKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(name.trim());
  }
  return merged.sort((a, b) => b.length - a.length);
}

export function findPlaceInTripBrief(
  tripBrief: string,
  destinations: { name: string }[] = [],
): string | null {
  const trimmed = tripBrief.trim();
  if (!trimmed) return null;

  const catalogKeys = new Set(catalogPlaceNames(destinations).map(normalizeKey));
  const matches: { place: string; index: number; fromCatalog: boolean; length: number }[] = [];

  for (const place of allPlaceCandidates(destinations)) {
    const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegex(place.trim())}([^a-z0-9]|$)`, 'i');
    const match = pattern.exec(trimmed);
    if (!match || match.index == null) continue;
    matches.push({
      place: place.trim(),
      index: match.index,
      fromCatalog: catalogKeys.has(normalizeKey(place)),
      length: place.trim().length,
    });
  }

  if (matches.length === 0) return null;

  matches.sort((a, b) => {
    if (a.fromCatalog !== b.fromCatalog) return a.fromCatalog ? -1 : 1;
    if (a.index !== b.index) return a.index - b.index;
    return a.length - b.length;
  });

  return matches[0].place;
}

function isBlockedToken(value: string): boolean {
  const key = normalizeKey(value);
  if (!key) return true;
  if (NON_PLACE_TERMS.has(key)) return true;
  return key.split(' ').every((word) => NON_PLACE_TERMS.has(word));
}

export type TripDestinationValidation =
  | { ok: true; place: string }
  | { ok: false; error: string };

export function validateTripBriefForItinerary(
  tripBrief: string,
  destinations: { name: string }[] = [],
): TripDestinationValidation {
  const trimmed = tripBrief.trim();
  if (!trimmed) {
    return { ok: false, error: 'Please describe your destination or trip details.' };
  }

  const resolved = findPlaceInTripBrief(trimmed, destinations);
  if (resolved) {
    return { ok: true, place: resolved };
  }

  const firstChunk = trimmed.split(/\r?\n/)[0]?.split(/[,–—-]/)[0]?.trim() ?? '';
  if (firstChunk && isBlockedToken(firstChunk)) {
    return {
      ok: false,
      error: 'Please name a real city, state, or country — not a price or trip detail.',
    };
  }

  return {
    ok: false,
    error:
      'Name a real place we can plan for — a city, state, or country (e.g. Gujarat, Kenya, Bali).',
  };
}