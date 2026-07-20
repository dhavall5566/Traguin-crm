import { describe, expect, it } from 'vitest';
import {
  parsePackageDurationDays,
  pickPackageBenchmark,
  scorePackageAgainstTrip,
} from './ai-package-benchmark';
import type { CmsPackageListRecord } from '@/lib/api/packages';

function pkg(partial: Partial<CmsPackageListRecord> & Pick<CmsPackageListRecord, 'title' | 'destinationName' | 'durationLabel' | 'price'>): CmsPackageListRecord {
  return {
    id: partial.id ?? 'p1',
    slug: partial.slug ?? 'test-package',
    destinationId: partial.destinationId ?? 'd1',
    soldLastMonth: 0,
    isFeatured: false,
    isPublished: true,
    createdAt: '',
    updatedAt: '',
    ...partial,
  };
}

describe('ai-package-benchmark', () => {
  it('parses duration labels', () => {
    expect(parsePackageDurationDays('5D/4N')).toBe(5);
    expect(parsePackageDurationDays('7 Days')).toBe(7);
  });

  it('prefers destination and duration matches', () => {
    const catalog = [
      pkg({ id: '1', title: 'Gujarat Heritage', destinationName: 'Gujarat', durationLabel: '5D/4N', price: 42000 }),
      pkg({ id: '2', title: 'Kerala Backwaters', destinationName: 'Kerala', durationLabel: '5D/4N', price: 38000 }),
    ];
    const scoreGujarat = scorePackageAgainstTrip(catalog[0], 'Gujarat family trip', 'Gujarat', 5);
    const scoreKerala = scorePackageAgainstTrip(catalog[1], 'Gujarat family trip', 'Gujarat', 5);
    expect(scoreGujarat).toBeGreaterThan(scoreKerala);
  });

  it('benchmarks from comparable package prices', () => {
    const catalog = [
      pkg({ id: '1', title: 'Gujarat Heritage', destinationName: 'Gujarat', durationLabel: '5D/4N', price: 40000 }),
      pkg({ id: '2', title: 'Gujarat Explorer', destinationName: 'Gujarat', durationLabel: '5D/4N', price: 44000 }),
    ];
    const benchmark = pickPackageBenchmark(catalog, 'Gujarat trip', 'Gujarat', 5);
    expect(benchmark).not.toBeNull();
    expect(benchmark!.itemsSubtotal).toBe(42000);
    expect(benchmark!.referencePackage.title).toBe('Gujarat Heritage');
  });
});
