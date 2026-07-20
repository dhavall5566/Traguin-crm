import type { ItineraryItem } from '@/lib/store';
import type { PackageBenchmark } from '@/lib/ai-package-benchmark';
import {
  ensureUniquePlaces,
  formatStructuredDetails,
  getArrivalCopy,
  getDayExploreTitle,
  getDaySightBundle,
  getDepartureCopy,
  getDestinationBaseArea,
  normalizeDestinationKey,
} from '@/lib/ai-destination-content';
import {
  buildItineraryRoutePlan,
  getPlannedDayRoute,
  type ItineraryRoutePlan,
} from '@/lib/ai-route-planner';
import {
  applyStyleToHotelCopy,
  applyStyleToMealCopy,
} from '@/lib/ai-travel-style';
import { PlaceUsageTracker } from '@/lib/itinerary-place-dedup';

export type AiTravelStyle =
  | 'Balanced'
  | 'Luxury'
  | 'Budget'
  | 'Adventure'
  | 'Family'
  | 'Culinary'
  | 'Relaxation';

type ItemType = ItineraryItem['type'];

type PriceBand = { min: number; max: number };

type DayItemTemplate = {
  type: ItemType;
  title: string;
  details: string;
  slot: number;
  day: number;
};

const STYLE_MULTIPLIER: Record<string, number> = {
  Budget: 0.92,
  Balanced: 1,
  Adventure: 1.04,
  Family: 1.02,
  Culinary: 1.03,
  Relaxation: 1.05,
  Luxury: 1.12,
};

const TYPE_WEIGHTS: Record<ItemType, number> = {
  HOTEL: 28,
  ACTIVITY: 25,
  TRANSFER: 12,
  MEAL: 15,
  FLIGHT: 20,
  NOTE: 2,
};

/** Fallback bands when no comparable catalog package exists. */
const FALLBACK_BANDS: Record<ItemType, PriceBand> = {
  TRANSFER: { min: 900, max: 3200 },
  HOTEL: { min: 1600, max: 5500 },
  MEAL: { min: 300, max: 1200 },
  ACTIVITY: { min: 600, max: 3800 },
  FLIGHT: { min: 8000, max: 25000 },
  NOTE: { min: 0, max: 0 },
};

export type AiDayDraft = {
  dayNumber: number;
  title: string;
  description: string;
  items: Omit<ItineraryItem, 'id'>[];
};

function itemSeed(day: number, slot: number): number {
  return (day * 17 + slot * 31) % 97;
}

function roundInr(amount: number, type: ItemType): number {
  const step = type === 'MEAL' ? 50 : type === 'TRANSFER' ? 100 : 500;
  return Math.round(amount / step) * step;
}

function pickFallbackSellingPrice(type: ItemType, style: string, day: number, slot: number): number {
  const band = FALLBACK_BANDS[type];
  const mult = STYLE_MULTIPLIER[style] ?? 1;
  const span = band.max - band.min;
  const offset = (itemSeed(day, slot) / 97) * span;
  return roundInr((band.min + offset) * mult, type);
}

function costMarginForStyle(style: string): number {
  if (style === 'Luxury') return 0.68;
  if (style === 'Budget') return 0.78;
  return 0.72;
}

function fallbackItemPrices(
  type: ItemType,
  style: string,
  day: number,
  slot: number,
): Pick<ItineraryItem, 'costPrice' | 'sellingPrice'> {
  const sellingPrice = pickFallbackSellingPrice(type, style, day, slot);
  const costPrice = roundInr(sellingPrice * costMarginForStyle(style), type);
  return { costPrice, sellingPrice };
}

function arrivalItems(hub: string, style: string, day: number, tracker: PlaceUsageTracker): DayItemTemplate[] {
  const copy = getArrivalCopy(hub);
  return [
    {
      type: 'ACTIVITY',
      slot: 0,
      day,
      title: 'Arrival sightseeing',
      details: formatStructuredDetails({
        category: 'SIGHTSEEING INCLUDED',
        places: ensureUniquePlaces(`${copy.transfer}; ${copy.tour}`, hub, 'sightseeing', tracker, 2),
      }),
    },
    {
      type: 'ACTIVITY',
      slot: 1,
      day,
      title: 'Evening experience',
      details: formatStructuredDetails({
        category: 'EVENING EXPERIENCE',
        places: ensureUniquePlaces(copy.evening, hub, 'optional', tracker, 1),
      }),
    },
    {
      type: 'HOTEL',
      slot: 2,
      day,
      title: 'Overnight stay',
      details: formatStructuredDetails({
        category: 'OVERNIGHT STAY',
        places: ensureUniquePlaces(
          applyStyleToHotelCopy(copy.overnight, style),
          hub,
          'overnight',
          tracker,
          1,
        ),
      }),
    },
    {
      type: 'MEAL',
      slot: 3,
      day,
      title: 'Meals included',
      details: formatStructuredDetails({
        category: 'MEALS INCLUDED',
        places: ensureUniquePlaces(
          applyStyleToMealCopy(copy.dinner, style),
          hub,
          'meals',
          tracker,
          1,
        ),
      }),
    },
  ];
}

function departureItems(hub: string, day: number, tracker: PlaceUsageTracker): DayItemTemplate[] {
  const copy = getDepartureCopy(hub);
  const area = getDestinationBaseArea(hub).split(/&|,/)[0]?.trim() ?? hub;
  return [
    {
      type: 'ACTIVITY',
      slot: 0,
      day,
      title: 'Final highlights',
      details: formatStructuredDetails({
        category: 'SIGHTSEEING INCLUDED',
        places: ensureUniquePlaces(copy.highlights, hub, 'sightseeing', tracker, 2),
      }),
    },
    {
      type: 'ACTIVITY',
      slot: 1,
      day,
      title: 'Evening experience',
      details: formatStructuredDetails({
        category: 'EVENING EXPERIENCE',
        places: ensureUniquePlaces(
          `Leisurely farewell stroll and last-minute souvenir stops in ${area}`,
          hub,
          'optional',
          tracker,
          1,
        ),
      }),
    },
    {
      type: 'MEAL',
      slot: 2,
      day,
      title: 'Meals included',
      details: formatStructuredDetails({
        category: 'MEALS INCLUDED',
        places: ensureUniquePlaces(copy.lunch, hub, 'meals', tracker, 1),
      }),
    },
    {
      type: 'TRANSFER',
      slot: 3,
      day,
      title: 'Airport transfer',
      details: formatStructuredDetails({
        category: 'TRANSFER INCLUDED',
        places: ensureUniquePlaces(copy.transfer, hub, 'meals', tracker, 1),
      }),
    },
  ];
}

function midDayItems(
  hub: string,
  style: string,
  theme: string,
  day: number,
  tracker: PlaceUsageTracker,
  routePlan: ItineraryRoutePlan,
): DayItemTemplate[] {
  const planned = getPlannedDayRoute(routePlan, day);
  const bundle = getDaySightBundle(hub, theme, day);

  const sightseeingRaw = [planned?.transferNote, bundle.sightseeing.places].filter(Boolean).join('; ');
  const sightseeing = ensureUniquePlaces(sightseeingRaw, hub, 'sightseeing', tracker, 2);

  const overnightCity = planned?.overnightCity ?? planned?.city;
  const overnightPlaces = applyStyleToHotelCopy(
    overnightCity
      ? `${overnightCity} — ${bundle.overnight.places}`
      : bundle.overnight.places,
    style,
  );

  return [
    {
      type: 'ACTIVITY',
      slot: 0,
      day,
      title: 'Sightseeing circuit',
      details: formatStructuredDetails({
        category: 'SIGHTSEEING INCLUDED',
        places: sightseeing,
      }),
    },
    {
      type: 'ACTIVITY',
      slot: 1,
      day,
      title: 'Evening experience',
      details: formatStructuredDetails({
        category: 'EVENING EXPERIENCE',
        places: ensureUniquePlaces(bundle.optional.places, hub, 'optional', tracker, 1),
      }),
    },
    {
      type: 'HOTEL',
      slot: 2,
      day,
      title: 'Overnight stay',
      details: formatStructuredDetails({
        category: 'OVERNIGHT STAY',
        places: ensureUniquePlaces(overnightPlaces, hub, 'overnight', tracker, 1),
      }),
    },
    {
      type: 'MEAL',
      slot: 3,
      day,
      title: 'Meals included',
      details: formatStructuredDetails({
        category: 'MEALS INCLUDED',
        places: ensureUniquePlaces(
          applyStyleToMealCopy(bundle.meals.places, style),
          hub,
          'meals',
          tracker,
          1,
        ),
      }),
    },
  ];
}

function collectTemplates(
  numDays: number,
  hub: string,
  tripBrief: string,
  style: string,
  themeTemplates: readonly string[],
): DayItemTemplate[] {
  const destinationKey = normalizeDestinationKey(hub);
  const routePlan = buildItineraryRoutePlan(hub, destinationKey, numDays, style);
  const templates: DayItemTemplate[] = [];
  const tracker = new PlaceUsageTracker();

  for (let day = 1; day <= numDays; day += 1) {
    const planned = getPlannedDayRoute(routePlan, day);
    if (day === 1) {
      templates.push(...arrivalItems(hub, style, day, tracker));
    } else if (day === numDays) {
      templates.push(...departureItems(hub, day, tracker));
    } else {
      const theme = planned?.theme ?? themeTemplates[(day - 2) % themeTemplates.length] ?? 'City Highlights';
      templates.push(...midDayItems(hub, style, theme, day, tracker, routePlan));
    }
  }
  return templates;
}

function applyPackageBenchmarkPricing(
  templates: DayItemTemplate[],
  benchmark: PackageBenchmark,
  style: string,
): Omit<ItineraryItem, 'id'>[] {
  const styleMult = STYLE_MULTIPLIER[style] ?? 1;
  const targetSubtotal = Math.round(benchmark.itemsSubtotal * styleMult);

  const typeCounts = templates.reduce<Record<string, number>>((acc, row) => {
    acc[row.type] = (acc[row.type] ?? 0) + 1;
    return acc;
  }, {});

  const weights = templates.map((row) => {
    const typeWeight = TYPE_WEIGHTS[row.type] ?? 10;
    const count = typeCounts[row.type] ?? 1;
    return typeWeight / count;
  });
  const totalWeight = weights.reduce((sum, w) => sum + w, 0) || 1;

  const margin = costMarginForStyle(style);
  const priced = templates.map((row, index) => {
    const rawSelling = (targetSubtotal * weights[index]) / totalWeight;
    const sellingPrice = Math.max(roundInr(rawSelling, row.type), row.type === 'NOTE' ? 0 : 100);
    const costPrice = roundInr(sellingPrice * margin, row.type);
    return {
      type: row.type,
      title: row.title,
      details: row.details,
      sellingPrice,
      costPrice,
    };
  });

  const currentSum = priced.reduce((sum, row) => sum + row.sellingPrice, 0);
  const delta = targetSubtotal - currentSum;
  if (delta !== 0 && priced.length > 0) {
    const adjustIdx = priced.findIndex((row) => row.type === 'ACTIVITY') >= 0
      ? priced.findIndex((row) => row.type === 'ACTIVITY')
      : 0;
    priced[adjustIdx] = {
      ...priced[adjustIdx],
      sellingPrice: Math.max(0, priced[adjustIdx].sellingPrice + delta),
      costPrice: roundInr(Math.max(0, priced[adjustIdx].sellingPrice + delta) * margin, priced[adjustIdx].type),
    };
  }

  return priced;
}

function templatesToItems(
  templates: DayItemTemplate[],
  style: string,
  benchmark: PackageBenchmark | null,
): Omit<ItineraryItem, 'id'>[] {
  if (benchmark) {
    return applyPackageBenchmarkPricing(templates, benchmark, style);
  }
  return templates.map((row) => ({
    type: row.type,
    title: row.title,
    details: row.details,
    ...fallbackItemPrices(row.type, style, row.day, row.slot),
  }));
}

export function buildAiItineraryDraft(
  numDays: number,
  hub: string,
  tripBrief: string,
  style: string,
  themeTemplates: readonly string[],
  benchmark: PackageBenchmark | null,
): AiDayDraft[] {
  const destinationKey = normalizeDestinationKey(hub);
  const routePlan = buildItineraryRoutePlan(hub, destinationKey, numDays, style);
  const templates = collectTemplates(numDays, hub, tripBrief, style, themeTemplates);
  const pricedItems = templatesToItems(templates, style, benchmark);

  const days: AiDayDraft[] = [];
  let cursor = 0;
  for (let day = 1; day <= numDays; day += 1) {
    const planned = getPlannedDayRoute(routePlan, day);
    const theme =
      planned?.theme ??
      (day === 1 || day === numDays
        ? themeTemplates[(day - 1) % themeTemplates.length]
        : themeTemplates[(day - 2) % themeTemplates.length]);
    const count =
      day === 1
        ? arrivalItems(hub, style, day, new PlaceUsageTracker()).length
        : day === numDays
          ? departureItems(hub, day, new PlaceUsageTracker()).length
          : midDayItems(hub, style, theme, day, new PlaceUsageTracker(), routePlan).length;
    const items = pricedItems.slice(cursor, cursor + count);
    cursor += count;
    days.push({
      dayNumber: day,
      title: getDayExploreTitle(hub, day, numDays, theme, planned?.city),
      description: planned?.transferNote ?? '',
      items,
    });
  }
  return days;
}

/** @deprecated Use buildAiItineraryDraft — kept for tests. */
export function buildAiDayItems(
  day: number,
  totalDays: number,
  hub: string,
  tripBrief: string,
  style: string,
  theme: string,
  benchmark: PackageBenchmark | null = null,
): Omit<ItineraryItem, 'id'>[] {
  const draft = buildAiItineraryDraft(totalDays, hub, tripBrief, style, [theme], benchmark);
  return draft.find((row) => row.dayNumber === day)?.items ?? [];
}

export function realisticItemPrices(
  type: ItemType,
  style: string,
  day: number,
  slot: number,
): Pick<ItineraryItem, 'costPrice' | 'sellingPrice'> {
  return fallbackItemPrices(type, style, day, slot);
}

export const AI_ITINERARY_MARKUP = 8;
export const AI_ITINERARY_TAX = 5;

export function estimateAiTripTotal(days: number, style: string): number {
  const draft = buildAiItineraryDraft(days, 'Trip', 'Trip', style, ['Highlights'], null);
  const itemsSubtotal = draft.reduce(
    (sum, day) => sum + day.items.reduce((s, item) => s + item.sellingPrice, 0),
    0,
  );
  const markupMult = 1 + AI_ITINERARY_MARKUP / 100;
  const taxMult = 1 + AI_ITINERARY_TAX / 100;
  return Number((itemsSubtotal * markupMult * taxMult).toFixed(2));
}
