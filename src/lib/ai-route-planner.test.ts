import { describe, expect, it } from 'vitest';
import { buildItineraryRoutePlan } from './ai-route-planner';
import { buildAiItineraryDraft } from './ai-itinerary-pricing';
import { pickThemeForStyle } from './ai-travel-style';

describe('ai-route-planner', () => {
  it('walks Kerala stops in geographic order without backtracking', () => {
    const plan = buildItineraryRoutePlan('Kerala', 'kerala', 5, 'Balanced');
    const middleCities = plan.days
      .filter((day) => !day.isArrival && !day.isDeparture)
      .map((day) => day.city);

    expect(middleCities).toEqual(['Munnar', 'Alleppey', 'Marari Beach']);
    expect(plan.days[0]?.city).toBe('Fort Kochi');
    expect(plan.days[4]?.city).toBe('Kochi');
  });

  it('keeps Sydney day trips on base city overnights', () => {
    const plan = buildItineraryRoutePlan('Australia', 'australia', 5, 'Adventure');
    const day2 = plan.days.find((day) => day.dayNumber === 2);
    expect(day2?.city).toBe('Blue Mountains');
    expect(day2?.overnightCity).toBe('Sydney');
    expect(day2?.transferNote).toMatch(/Blue Mountains/i);
  });

  it('prefers adventure themes when style is Adventure', () => {
    expect(pickThemeForStyle(['City Highlights', 'Adventure Track'], 'Adventure')).toBe(
      'Adventure Track',
    );
    expect(pickThemeForStyle(['City Highlights', 'Wellness Day'], 'Relaxation')).toBe(
      'Wellness Day',
    );
  });

  it('embeds transfer notes in generated sightseeing for sequential days', () => {
    const draft = buildAiItineraryDraft(5, 'Kerala', 'Kerala trip', 'Family', [], null);
    const day3 = draft.find((day) => day.dayNumber === 3);
    const sightseeing = day3?.items.find((item) => item.details.includes('SIGHTSEEING INCLUDED'));
    expect(sightseeing?.details).toMatch(/Alleppey|Munnar|transfer/i);
    expect(day3?.title).toMatch(/^Alleppey —/i);
  });
});
