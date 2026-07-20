/** Validate destination names for CRM forms (place names, not package sentences). */

const PACKAGE_JARGON_RE =
  /\d+\s*d\s*\/\s*\d+\s*n|\bpackage\b|\bitinerary\b|\btour\s+plan\b|\blooking\s+for\b|\bi\s+want\b/i;

const ALLOWED_CHARS_RE = /^[a-zA-ZÀ-ÿ0-9][a-zA-ZÀ-ÿ0-9\s,'.\-&()/]*$/;

export function matchesKnownDestination(
  value: string,
  destinations: { name: string }[],
): boolean {
  const query = value.trim().toLowerCase();
  if (!query) return false;
  return destinations.some((row) => {
    const name = row.name.trim().toLowerCase();
    return name === query || name.includes(query) || query.includes(name);
  });
}

export function validateDestinationName(
  value: string,
  destinations: { name: string }[] = [],
): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return 'Please enter a destination.';

  if (destinations.length > 0 && matchesKnownDestination(trimmed, destinations)) {
    return undefined;
  }

  if (trimmed.length < 2 || trimmed.length > 100) {
    return 'This is not a proper destination name.';
  }

  if (PACKAGE_JARGON_RE.test(trimmed)) {
    return 'This is not a proper destination name.';
  }

  const letterCount = (trimmed.match(/[a-zA-ZÀ-ÿ]/g) ?? []).length;
  if (letterCount < 2) {
    return 'This is not a proper destination name.';
  }

  if (!ALLOWED_CHARS_RE.test(trimmed)) {
    return 'This is not a proper destination name.';
  }

  const digitCount = (trimmed.match(/\d/g) ?? []).length;
  if (digitCount / trimmed.length > 0.35) {
    return 'This is not a proper destination name.';
  }

  const words = trimmed.split(/[\s,]+/).filter(Boolean);
  if (words.length > 5) {
    return 'This is not a proper destination name.';
  }

  if (destinations.length > 0) {
    return 'This is not a proper destination name.';
  }

  return undefined;
}
