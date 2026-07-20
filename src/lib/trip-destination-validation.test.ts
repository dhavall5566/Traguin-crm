import { describe, expect, it } from 'vitest';
import {
  findPlaceInTripBrief,
  validateTripBriefForItinerary,
} from './trip-destination-validation';

describe('trip-destination-validation', () => {
  const catalog = [{ name: 'Gujarat' }, { name: 'Kerala' }];

  it('finds real places in free-form briefs', () => {
    expect(findPlaceInTripBrief('5-day Gujarat family trip', catalog)).toBe('Gujarat');
    expect(findPlaceInTripBrief('Kenya safari for 7 days', catalog)).toBe('Kenya');
    expect(findPlaceInTripBrief('Honeymoon in Bali, Indonesia', catalog)).toBe('Bali');
  });

  it('rejects non-place tokens like total/toatl', () => {
    expect(validateTripBriefForItinerary('toatl', catalog).ok).toBe(false);
    expect(validateTripBriefForItinerary('total price trip', catalog).ok).toBe(false);
  });

  it('accepts catalog destinations', () => {
    const result = validateTripBriefForItinerary('Looking at Kerala backwaters', catalog);
    expect(result).toEqual({ ok: true, place: 'Kerala' });
  });
});
