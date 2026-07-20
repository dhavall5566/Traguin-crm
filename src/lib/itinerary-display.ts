/** Remove rupee amounts and price phrases from text shown on itineraries. */
import { ensureUniquePlaces, getDestinationDayPlanSegments } from '@/lib/ai-destination-content';
import { PlaceUsageTracker } from '@/lib/itinerary-place-dedup';
import { findPlaceInTripBrief } from '@/lib/trip-destination-validation';

export function stripItineraryPriceMentions(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';

  return trimmed
    .replace(
      /\s*[·•|–—-]\s*₹[\d,]+(?:\.\d+)?(?:\s*(?:all-inclusive|incl\.?\s*tax(?:es)?|per\s+(?:night|group|person|guest|pax)|\/\w+))?/gi,
      '',
    )
    .replace(
      /₹[\d,]+(?:\.\d+)?(?:\s*(?:all-inclusive|incl\.?\s*tax(?:es)?|per\s+(?:night|group|person|guest|pax)|\/\w+))?/gi,
      '',
    )
    .replace(/\bunder\s+₹[\d,]+(?:\/\w+)?/gi, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export interface StructuredActivityDetails {
  category: string;
  places: string;
}

const TIME_TITLE_SEP = ' — ';

const STRUCTURED_CATEGORY_PATTERN =
  /^(TRANSFER INCLUDED|SIGHTSEEING INCLUDED|OPTIONAL ACTIVITIES|EVENING EXPERIENCE|OVERNIGHT STAY|MEALS INCLUDED)$/i;

export const DAY_PLAN_SEGMENT_ORDER = [
  'SIGHTSEEING INCLUDED',
  'EVENING EXPERIENCE',
  'OVERNIGHT STAY',
  'MEALS INCLUDED',
] as const;

function normalizePlanCategory(category: string): string {
  const upper = category.trim().toUpperCase();
  if (upper === 'OPTIONAL ACTIVITIES') return 'EVENING EXPERIENCE';
  return upper;
}

/** Map a clock time or period prefix to Morning / Afternoon / Evening. */
export function formatActivityPeriod(timePart: string): string {
  const normalized = timePart.trim();
  if (!normalized || normalized === '—') return '—';

  const periodMatch = normalized.match(/^(morning|afternoon|evening)$/i);
  if (periodMatch) {
    const word = periodMatch[1].toLowerCase();
    return word.charAt(0).toUpperCase() + word.slice(1);
  }

  const clockMatch = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!clockMatch) return normalized;

  let hours = Number(clockMatch[1]);
  const minutes = Number(clockMatch[2]);
  const meridiem = clockMatch[3].toUpperCase();

  if (meridiem === 'PM' && hours !== 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;

  const totalMinutes = hours * 60 + minutes;
  if (totalMinutes < 12 * 60) return 'Morning';
  if (totalMinutes < 17 * 60) return 'Afternoon';
  return 'Evening';
}

export function splitActivityDisplayTitle(title: string): { time: string; label: string } {
  const sep = title.indexOf(TIME_TITLE_SEP);
  if (sep === -1) return { time: '—', label: title };
  const rawTime = title.slice(0, sep).trim();
  return {
    time: formatActivityPeriod(rawTime),
    label: title.slice(sep + TIME_TITLE_SEP.length).trim(),
  };
}

export function formatActivityTitle(period: string, label: string): string {
  const normalized = formatActivityPeriod(period);
  if (!label.trim() || normalized === '—') return label.trim();
  return `${normalized}${TIME_TITLE_SEP}${label.trim()}`;
}

/** Split "City — landmark" day titles for display. */
export function parseDayExploreTitle(title: string): { city: string; highlight: string } {
  const trimmed = title.trim();
  const legacy = trimmed.replace(/^Day\s+\d+\s*:\s*/i, '').trim();
  const sep = legacy.indexOf(TIME_TITLE_SEP);
  if (sep === -1) return { city: legacy, highlight: '' };
  return {
    city: legacy.slice(0, sep).trim(),
    highlight: legacy.slice(sep + TIME_TITLE_SEP.length).trim(),
  };
}

/** Parse category + comma-separated places stored in activity details. */
export function parseStructuredActivityDetails(details: string): StructuredActivityDetails | null {
  const trimmed = stripItineraryPriceMentions(details);
  if (!trimmed) return null;

  const newline = trimmed.indexOf('\n');
  if (newline === -1) return null;

  const category = trimmed.slice(0, newline).trim();
  const places = trimmed.slice(newline + 1).trim();
  if (!category || !places) return null;
  if (!STRUCTURED_CATEGORY_PATTERN.test(category)) return null;

  return { category: normalizePlanCategory(category), places };
}

/** Body text for plan cards — structured places or second line of legacy details. */
export function getActivityDetailBody(details: string): string {
  const structured = parseStructuredActivityDetails(details);
  if (structured) return structured.places;

  const trimmed = stripItineraryPriceMentions(details);
  if (!trimmed) return '';

  const newline = trimmed.indexOf('\n');
  if (newline !== -1) return trimmed.slice(newline + 1).trim();
  return trimmed;
}

type PlanDayItem = {
  details: string;
  title: string;
  type?: string;
};

function inferLegacySegmentCategory(
  item: PlanDayItem,
  index: number,
): (typeof DAY_PLAN_SEGMENT_ORDER)[number] {
  const type = item.type?.toUpperCase();
  if (type === 'HOTEL') return 'OVERNIGHT STAY';
  if (type === 'MEAL') return 'MEALS INCLUDED';
  if (type === 'TRANSFER') return 'SIGHTSEEING INCLUDED';

  const period = splitActivityDisplayTitle(item.title).time;
  if (period === 'Morning') return 'SIGHTSEEING INCLUDED';
  if (period === 'Afternoon') return 'EVENING EXPERIENCE';
  if (period === 'Evening') return 'MEALS INCLUDED';

  return DAY_PLAN_SEGMENT_ORDER[Math.min(index, DAY_PLAN_SEGMENT_ORDER.length - 1)];
}

function legacyItemBody(item: PlanDayItem): string {
  return (
    getActivityDetailBody(item.details) ||
    splitActivityDisplayTitle(item.title).label ||
    stripItineraryPriceMentions(item.details) ||
    item.title.trim()
  );
}

const GENERIC_PLAN_PATTERNS = [
  /private sedan with meet-and-greet/i,
  /half-day guided circuit with entry tickets/i,
  /guided experience with transport/i,
  /reserved table for \d guests/i,
  /balanced dining/i,
  /local lunch/i,
  /welcome dinner/i,
  /set menu for \d guests/i,
  /twin\/double room with breakfast/i,
  /premium selected hotel/i,
  /airport pickup/i,
  /airport transfer/i,
  /orientation tour/i,
  /arrival & orientation/i,
  /flexible morning sightseeing/i,
  /à la carte lunch/i,
  /harbour dinner cruise/i,
];

function isGenericPlanText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  return GENERIC_PLAN_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/** Extract destination hub from itinerary title/description for enrichment. */
export function extractItineraryHub(itinerary: {
  title: string;
  description?: string;
}): string {
  const aiMatch = itinerary.title.match(/^AI:\s*(.+?)\s+\d+\s*-?\s*Day\b/i);
  if (aiMatch?.[1]?.trim()) return aiMatch[1].trim();

  const fromDescription = findPlaceInTripBrief(itinerary.description ?? '', []);
  if (fromDescription) return fromDescription;

  const fromTitle = findPlaceInTripBrief(itinerary.title, []);
  if (fromTitle) return fromTitle;

  return '';
}

export type BuildDayPlanOptions = {
  dayTitle?: string;
  hub?: string;
  dayNumber?: number;
  totalDays?: number;
  placeTracker?: PlaceUsageTracker;
};

function applyPlaceDedup(
  segments: StructuredActivityDetails[],
  hub: string | undefined,
  placeTracker: PlaceUsageTracker | undefined,
): StructuredActivityDetails[] {
  if (!placeTracker || !hub) return segments;

  const segmentKeys = {
    'SIGHTSEEING INCLUDED': 'sightseeing',
    'EVENING EXPERIENCE': 'optional',
    'OVERNIGHT STAY': 'overnight',
    'MEALS INCLUDED': 'meals',
  } as const;

  return segments.map((segment) => {
    const key = segmentKeys[segment.category as keyof typeof segmentKeys];
    if (!key) return segment;
    return {
      category: segment.category,
      places: ensureUniquePlaces(segment.places, hub, key, placeTracker, 1),
    };
  });
}

/** Build the four client-facing plan cards for a day. */
export function buildDayPlanSegments(
  items: ReadonlyArray<PlanDayItem>,
  options?: BuildDayPlanOptions,
): StructuredActivityDetails[] {
  const merged = new Map<string, string[]>();

  for (const item of items) {
    const structured = parseStructuredActivityDetails(item.details);
    if (!structured) continue;

    if (structured.category === 'TRANSFER INCLUDED') {
      if (merged.has('MEALS INCLUDED')) {
        merged.set('MEALS INCLUDED', [...merged.get('MEALS INCLUDED')!, structured.places]);
      } else {
        const sightseeing = merged.get('SIGHTSEEING INCLUDED') ?? [];
        merged.set('SIGHTSEEING INCLUDED', [...sightseeing, structured.places]);
      }
      continue;
    }

    const existing = merged.get(structured.category) ?? [];
    merged.set(structured.category, [...existing, structured.places]);
  }

  items.forEach((item, index) => {
    if (parseStructuredActivityDetails(item.details)) return;

    const body = legacyItemBody(item);
    if (!body) return;

    const category = inferLegacySegmentCategory(item, index);
    const existing = merged.get(category) ?? [];
    merged.set(category, [...existing, body]);
  });

  const profileSegments =
    options?.hub && options.dayNumber && options.totalDays
      ? getDestinationDayPlanSegments(
          options.hub,
          options.dayNumber,
          options.totalDays,
          options.dayTitle,
        )
      : null;

  const profileByCategory = new Map(
    (profileSegments ?? []).map((segment) => [segment.category, segment.places]),
  );

  const segments = DAY_PLAN_SEGMENT_ORDER.map((category) => {
    const fromItems = merged.get(category)?.join('; ').trim() ?? '';
    const fromProfile = profileByCategory.get(category)?.trim() ?? '';

    let places = fromItems;
    if (fromProfile && (!fromItems || isGenericPlanText(fromItems))) {
      places = fromProfile;
    } else if (!places && fromProfile) {
      places = fromProfile;
    }

    return { category, places };
  });

  return applyPlaceDedup(segments, options?.hub, options?.placeTracker);
}

type PlanDayInput = {
  id: string;
  dayNumber: number;
  title: string;
  items: ReadonlyArray<PlanDayItem>;
};

/** Build plan segments for all days in order so landmarks never repeat. */
export function buildSequentialDayPlanSegments(
  days: ReadonlyArray<PlanDayInput>,
  hub: string,
): Map<string, StructuredActivityDetails[]> {
  const tracker = new PlaceUsageTracker();
  const result = new Map<string, StructuredActivityDetails[]>();
  const totalDays = days.length;
  const sorted = [...days].sort((a, b) => a.dayNumber - b.dayNumber);

  for (const day of sorted) {
    result.set(
      day.id,
      buildDayPlanSegments(day.items, {
        dayTitle: day.title,
        hub,
        dayNumber: day.dayNumber,
        totalDays,
        placeTracker: tracker,
      }),
    );
  }

  return result;
}

/** Plan card header from structured segment category. */
export function resolvePlanCardCategory(title: string, details: string, slotIndex: number): string {
  void title;
  void slotIndex;
  const structured = parseStructuredActivityDetails(details);
  if (structured) return structured.category;
  return DAY_PLAN_SEGMENT_ORDER[Math.min(slotIndex, DAY_PLAN_SEGMENT_ORDER.length - 1)];
}
