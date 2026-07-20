import { describe, expect, it } from 'vitest';
import { stripItineraryPriceMentions } from './itinerary-display';

describe('stripItineraryPriceMentions', () => {
  it('removes rupee amounts and price suffixes', () => {
    expect(stripItineraryPriceMentions('Private sedan · ₹3,100 all-inclusive')).toBe(
      'Private sedan',
    );
    expect(stripItineraryPriceMentions('Half-day tour · ₹8,000 per group')).toBe('Half-day tour');
  });

  it('preserves non-price copy', () => {
    expect(stripItineraryPriceMentions('Kenya safari\nMorning game drive')).toBe(
      'Kenya safari\nMorning game drive',
    );
  });
});
