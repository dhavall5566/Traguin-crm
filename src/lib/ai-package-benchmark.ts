import type { CmsPackageListRecord } from '@/lib/api/packages';

function matchesKnownDestination(value: string, destinations: { name: string }[]): boolean {
  const query = value.trim().toLowerCase();
  if (!query) return false;
  return destinations.some((row) => {
    const name = row.name.trim().toLowerCase();
    return name === query || name.includes(query) || query.includes(name);
  });
}

export type PackageBenchmark = {
  /** Primary reference package used for pricing. */
  referencePackage: CmsPackageListRecord;
  /** Comparable packages considered (includes reference). */
  comparablePackages: CmsPackageListRecord[];
  /** Target items subtotal (INR) before itinerary markup/tax. */
  itemsSubtotal: number;
};

/** Parse day count from labels like `5D/4N` or `7 Days`. */
export function parsePackageDurationDays(durationLabel: string): number | null {
  const trimmed = durationLabel.trim();
  if (!trimmed) return null;
  const dMatch = trimmed.match(/(\d+)\s*d\b/i);
  if (dMatch) return Number(dMatch[1]);
  const daysMatch = trimmed.match(/(\d+)\s*days?\b/i);
  if (daysMatch) return Number(daysMatch[1]);
  return null;
}

function destinationScore(
  pkg: CmsPackageListRecord,
  tripBrief: string,
  hub: string,
  destinations: { name: string }[],
): number {
  const brief = tripBrief.toLowerCase();
  const hubLower = hub.toLowerCase();
  const dest = pkg.destinationName.trim().toLowerCase();
  const title = pkg.title.trim().toLowerCase();

  if (dest === hubLower || hubLower.includes(dest) || dest.includes(hubLower)) return 50;
  if (brief.includes(dest) || title.includes(hubLower)) return 35;
  if (matchesKnownDestination(hub, [{ name: pkg.destinationName }])) return 45;
  if (matchesKnownDestination(tripBrief, [{ name: pkg.destinationName }])) return 40;
  if (destinations.some((row) => brief.includes(row.name.toLowerCase()) && row.name.toLowerCase() === dest)) {
    return 30;
  }
  return 0;
}

function durationScore(pkg: CmsPackageListRecord, numDays: number): number {
  const pkgDays = parsePackageDurationDays(pkg.durationLabel);
  if (pkgDays == null || !Number.isFinite(numDays)) return 0;
  const diff = Math.abs(pkgDays - numDays);
  if (diff === 0) return 40;
  if (diff === 1) return 28;
  if (diff === 2) return 15;
  return Math.max(0, 8 - diff * 4);
}

export function scorePackageAgainstTrip(
  pkg: CmsPackageListRecord,
  tripBrief: string,
  hub: string,
  numDays: number,
  destinations: { name: string }[] = [],
): number {
  const dest = destinationScore(pkg, tripBrief, hub, destinations);
  if (dest === 0) return 0;
  return dest + durationScore(pkg, numDays);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }
  return sorted[mid];
}

function scalePackagePrice(pkg: CmsPackageListRecord, numDays: number): number {
  const refDays = parsePackageDurationDays(pkg.durationLabel);
  if (refDays == null || refDays <= 0 || !Number.isFinite(numDays) || numDays <= 0) {
    return pkg.price;
  }
  if (refDays === numDays) return pkg.price;
  return Math.round(pkg.price * (numDays / refDays));
}

/**
 * Pick comparable catalog packages and derive a benchmark items subtotal.
 * Returns null when no reasonable catalog match exists.
 */
export function pickPackageBenchmark(
  packages: CmsPackageListRecord[],
  tripBrief: string,
  hub: string,
  numDays: number,
  destinations: { name: string }[] = [],
): PackageBenchmark | null {
  if (packages.length === 0) return null;

  const ranked = packages
    .map((pkg) => ({
      pkg,
      score: scorePackageAgainstTrip(pkg, tripBrief, hub, numDays, destinations),
    }))
    .filter((row) => row.score >= 35)
    .sort((a, b) => b.score - a.score || a.pkg.price - b.pkg.price);

  let pool: CmsPackageListRecord[];
  if (ranked.length > 0) {
    pool = ranked.slice(0, Math.min(5, ranked.length)).map((row) => row.pkg);
  } else {
    const durationMatches = packages
      .map((pkg) => ({
        pkg,
        days: parsePackageDurationDays(pkg.durationLabel),
      }))
      .filter((row) => row.days != null && Math.abs(row.days - numDays) <= 1)
      .sort(
        (a, b) =>
          Math.abs(a.days! - numDays) - Math.abs(b.days! - numDays) || a.pkg.price - b.pkg.price,
      );
    if (durationMatches.length === 0) return null;
    pool = durationMatches.slice(0, Math.min(5, durationMatches.length)).map((row) => row.pkg);
  }

  const scaledPrices = pool.map((pkg) => scalePackagePrice(pkg, numDays));
  const itemsSubtotal = median(scaledPrices);
  if (itemsSubtotal <= 0) return null;

  return {
    referencePackage: pool[0],
    comparablePackages: pool,
    itemsSubtotal,
  };
}
