import { findPlaceInTripBrief } from '@/lib/trip-destination-validation';

export type ItineraryRailMeta = {
  isAi: boolean;
  destination: string;
  durationDays: number;
};

/** Sidebar display labels — prefers loaded days, falls back to title duration. */
export function getItineraryRailMeta(title: string, dayCount: number): ItineraryRailMeta {
  const trimmed = title.trim();
  const aiMatch = trimmed.match(/^AI:\s*(.+?)\s+(\d+)\s*-?\s*Day\b/i);

  if (aiMatch) {
    const destination = aiMatch[1].trim();
    const fromTitle = Number(aiMatch[2]);
    const durationDays = dayCount > 0 ? dayCount : fromTitle;
    return { isAi: true, destination, durationDays };
  }

  const destination = findPlaceInTripBrief(trimmed, []) ?? trimmed;
  return {
    isAi: false,
    destination,
    durationDays: dayCount,
  };
}

export function formatRailDuration(days: number): string {
  if (days <= 0) return 'No days yet';
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

export function formatRailPrice(total: number): string {
  if (total <= 0) return '—';
  return `₹${total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}
