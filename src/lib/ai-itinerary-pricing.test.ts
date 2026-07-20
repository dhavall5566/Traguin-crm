import { describe, expect, it } from 'vitest';
import {
  buildAiDayItems,
  buildAiItineraryDraft,
  estimateAiTripTotal,
  realisticItemPrices,
} from './ai-itinerary-pricing';
import { findPlaceInTripBrief } from './trip-destination-validation';
import { normalizePlaceKey, splitPlacesList } from './itinerary-place-dedup';
import { buildSequentialDayPlanSegments } from './itinerary-display';

function collectSegmentPlaces(draft: ReturnType<typeof buildAiItineraryDraft>): string[] {
  const days = draft.map((day, index) => ({
    id: `day-${index}`,
    dayNumber: day.dayNumber,
    title: day.title,
    items: day.items,
  }));
  const segmentsByDay = buildSequentialDayPlanSegments(days, 'Australia');
  const places: string[] = [];
  for (const segments of segmentsByDay.values()) {
    for (const segment of segments) {
      places.push(...splitPlacesList(segment.places));
    }
  }
  return places.map(normalizePlaceKey).filter(Boolean);
}

function hasDuplicatePlaces(places: string[]): boolean {
  const seen = new Set<string>();
  for (const place of places) {
    for (const existing of seen) {
      if (place.includes(existing) || existing.includes(place)) return true;
    }
    seen.add(place);
  }
  return false;
}

describe('ai-itinerary-pricing', () => {
  it('extracts a short hub from multi-line briefs', () => {
    expect(findPlaceInTripBrief('Gujarat family trip\nAhmedabad and Kutch', [{ name: 'Gujarat' }])).toBe(
      'Gujarat',
    );
    expect(findPlaceInTripBrief('Honeymoon in Bali, Indonesia', [])).toBe('Bali');
  });

  it('returns item-type-appropriate INR amounts', () => {
    const meal = realisticItemPrices('MEAL', 'Balanced', 2, 1);
    const hotel = realisticItemPrices('HOTEL', 'Luxury', 2, 0);
    expect(meal.sellingPrice % 50).toBe(0);
    expect(hotel.sellingPrice % 500).toBe(0);
    expect(meal.sellingPrice).toBeGreaterThanOrEqual(300);
    expect(meal.sellingPrice).toBeLessThanOrEqual(2000);
    expect(hotel.sellingPrice).toBeGreaterThan(meal.sellingPrice);
    expect(meal.costPrice).toBeLessThan(meal.sellingPrice);
  });

  it('builds day items without prices in visible details', () => {
    const items = buildAiDayItems(1, 5, 'Gujarat', 'Gujarat heritage tour', 'Balanced', 'Heritage');
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.sellingPrice > 0 && i.costPrice > 0)).toBe(true);
    expect(items.every((i) => !i.details.includes('₹'))).toBe(true);
    expect(items.some((i) => i.type === 'TRANSFER')).toBe(true);
    expect(items.some((i) => i.details.includes('SIGHTSEEING INCLUDED'))).toBe(true);
    expect(items.some((i) => i.details.includes('Sabarmati Ashram') || i.details.includes('Rani ki Vav'))).toBe(
      true,
    );
  });

  it('includes famous landmarks for Bali middle days', () => {
    const items = buildAiDayItems(2, 5, 'Bali', 'Bali honeymoon', 'Balanced', 'Nature & Viewpoints');
    const joined = items.map((i) => i.details).join(' ');
    expect(joined).toMatch(/Tegallalang|Tirta Empul|Goa Gajah/i);
    expect(items.some((i) => i.details.includes('EVENING EXPERIENCE'))).toBe(true);
    expect(items.length).toBe(4);
  });

  it('includes Solang Valley landmarks for Manali', () => {
    const items = buildAiDayItems(2, 5, 'Manali', 'Manali snow trip', 'Adventure', 'Nature & Viewpoints');
    const joined = items.map((i) => i.details).join(' ');
    expect(joined).toMatch(/Solang Valley|Atal Tunnel/i);
  });

  it('allocates line items from a catalog package benchmark', () => {
    const benchmark = {
      referencePackage: {
        id: '1',
        slug: 'gujarat',
        destinationId: 'd1',
        destinationName: 'Gujarat',
        title: 'Gujarat Heritage',
        durationLabel: '5D/4N',
        price: 42000,
        soldLastMonth: 0,
        isFeatured: false,
        isPublished: true,
        createdAt: '',
        updatedAt: '',
      },
      comparablePackages: [],
      itemsSubtotal: 42000,
    };
    const draft = buildAiItineraryDraft(5, 'Gujarat', 'Gujarat trip', 'Balanced', ['Heritage'], benchmark);
    expect(draft[0]?.title).toMatch(/Ahmedabad — Sabarmati Ashram/i);
    expect(draft[1]?.title).toMatch(/—/);
    expect(draft[1]?.title).not.toMatch(/^Day \d+:/);
    const subtotal = draft.reduce(
      (sum, day) => sum + day.items.reduce((s, item) => s + item.sellingPrice, 0),
      0,
    );
    expect(subtotal).toBe(42000);
  });

  it('falls back when no catalog benchmark is available', () => {
    expect(estimateAiTripTotal(5, 'Balanced')).toBeLessThan(55000);
  });

  it('includes hotel stays on middle days', () => {
    const items = buildAiDayItems(3, 5, 'Kerala', 'Backwaters trip', 'Family', 'Nature');
    expect(items.some((i) => i.type === 'HOTEL')).toBe(true);
  });

  it('does not repeat landmark details across Australia days', () => {
    const draft = buildAiItineraryDraft(
      5,
      'Australia',
      'Sydney honeymoon',
      'Balanced',
      ['City Highlights', 'Nature & Viewpoints', 'Adventure Track'],
      null,
    );
    const places = collectSegmentPlaces(draft);
    expect(places.length).toBeGreaterThan(0);
    expect(hasDuplicatePlaces(places)).toBe(false);

    const dayTwoSightseeing = draft[1]?.items.find((item) =>
      item.details.includes('SIGHTSEEING INCLUDED'),
    )?.details;
    expect(dayTwoSightseeing).not.toMatch(/Sydney Opera House/i);
  });
});
