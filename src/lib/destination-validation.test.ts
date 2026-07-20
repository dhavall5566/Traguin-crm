import { describe, expect, it } from 'vitest';
import { matchesKnownDestination, validateDestinationName } from './destination-validation';

const catalog = [{ name: 'Gujarat' }, { name: 'Bali, Indonesia' }, { name: 'Kerala' }];

describe('validateDestinationName', () => {
  it('accepts known CMS destinations', () => {
    expect(validateDestinationName('Gujarat', catalog)).toBeUndefined();
    expect(validateDestinationName('bali', catalog)).toBeUndefined();
  });

  it('rejects package-style sentences', () => {
    expect(validateDestinationName('I want 5D/4N Kerala package', catalog)).toBe(
      'This is not a proper destination name.',
    );
  });

  it('rejects unknown values when catalog is loaded', () => {
    expect(validateDestinationName('asdfgh random', catalog)).toBe(
      'This is not a proper destination name.',
    );
  });

  it('rejects empty input', () => {
    expect(validateDestinationName('', catalog)).toBe('Please enter a destination.');
  });
});

describe('matchesKnownDestination', () => {
  it('matches partial names', () => {
    expect(matchesKnownDestination('Indonesia', catalog)).toBe(true);
  });
});
