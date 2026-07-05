'use client';

import React, { useMemo, useState } from 'react';
import { Package, Search, Globe, Lock, X, MapPin, Clock, IndianRupee } from 'lucide-react';
import {
  EMPTY_PACKAGE_CATALOG_FILTERS,
  usePackagesCatalog,
  type PackageCatalogFilters,
} from '@/hooks/usePackagesCatalog';
import { CrmTablePagination } from '@/components/ui/CrmTablePagination';
import { CrmTableSkeleton } from '@/components/ui/CrmTableSkeleton';
import { CrmTablePanel } from '@/components/ui/CrmTablePanel';

type VisibilityFilter = 'all' | 'website' | 'internal';

const VISIBILITY_OPTIONS: { value: VisibilityFilter; label: string; Icon?: typeof Globe }[] = [
  { value: 'all', label: 'All' },
  { value: 'website', label: 'Website', Icon: Globe },
  { value: 'internal', label: 'Internal', Icon: Lock },
];

const VISIBILITY_INDEX: Record<VisibilityFilter, number> = {
  all: 0,
  website: 1,
  internal: 2,
};

export default function PackagesPage() {
  const [visibility, setVisibility] = useState<VisibilityFilter>('all');
  const [filters, setFilters] = useState<PackageCatalogFilters>(EMPTY_PACKAGE_CATALOG_FILTERS);
  const publishedFilter =
    visibility === 'website' ? true : visibility === 'internal' ? false : undefined;

  const {
    items,
    total,
    search,
    setSearch,
    offset,
    setOffset,
    pageSize,
    loading,
    error,
    filterOptions,
  } = usePackagesCatalog({ published: publishedFilter, filters });

  const page = Math.floor(offset / pageSize) + 1;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const summary = useMemo(() => {
    const websiteCount = items.filter((item) => item.isPublished).length;
    return { websiteCount, pageCount: items.length };
  }, [items]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (visibility !== 'all') count += 1;
    if (filters.destinationId) count += 1;
    if (filters.duration) count += 1;
    if (filters.minPrice.trim()) count += 1;
    if (filters.maxPrice.trim()) count += 1;
    if (search.trim()) count += 1;
    return count;
  }, [visibility, filters, search]);

  const clearFilters = () => {
    setVisibility('all');
    setFilters(EMPTY_PACKAGE_CATALOG_FILTERS);
    setSearch('');
  };

  return (
    <div className="crm-page">
      <header className="crm-page-header">
        <div>
          <p className="crm-page-eyebrow">Catalog</p>
          <h1 className="crm-page-header__title">Packages</h1>
          <p className="crm-page-header__meta">
            Full CMS catalog for sales — upload once in CMS; website shows published packages only.
          </p>
        </div>
      </header>

      <CrmTablePanel className="crm-packages-panel">
        <div className="crm-packages-header">
          <div className="crm-packages-header__title-row">
            <div>
              <h2 className="crm-packages-header__title">CMS package catalog</h2>
              <p className="crm-packages-header__subtitle">
                {total.toLocaleString('en-IN')} packages
                {activeFilterCount > 0
                  ? ` · ${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} active`
                  : ''}
              </p>
            </div>
            {activeFilterCount > 0 ? (
              <button type="button" className="crm-packages-header__clear" onClick={clearFilters}>
                <X className="h-3.5 w-3.5" aria-hidden />
                Clear all
              </button>
            ) : null}
          </div>

          <div className="crm-packages-header__search">
            <Search className="crm-packages-header__search-icon" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, slug, or destination…"
              className="crm-packages-header__search-input"
              aria-label="Search packages"
            />
          </div>

          <div className="crm-packages-header__filters">
            <div className="crm-packages-filter">
              <span className="crm-packages-filter__label">Visibility</span>
              <div
                className="crm-packages-visibility"
                role="tablist"
                aria-label="Package visibility"
                style={{ '--visibility-index': VISIBILITY_INDEX[visibility] } as React.CSSProperties}
              >
                <span className="crm-packages-visibility__glide" aria-hidden />
                {VISIBILITY_OPTIONS.map((option) => {
                  const Icon = option.Icon;
                  const isActive = visibility === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      className={`crm-packages-visibility__btn${
                        isActive ? ' crm-packages-visibility__btn--active' : ''
                      }`}
                      onClick={() => setVisibility(option.value)}
                    >
                      {Icon ? <Icon className="crm-packages-visibility__icon" aria-hidden /> : null}
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="crm-packages-filter">
              <label className="crm-packages-filter__label" htmlFor="packages-destination">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                Destination
              </label>
              <select
                id="packages-destination"
                value={filters.destinationId}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, destinationId: e.target.value }))
                }
                className="crm-packages-filter__control"
              >
                <option value="">All destinations</option>
                {filterOptions.destinations.map((destination) => (
                  <option key={destination.id} value={destination.id}>
                    {destination.name} ({destination.count})
                  </option>
                ))}
              </select>
            </div>

            <div className="crm-packages-filter">
              <label className="crm-packages-filter__label" htmlFor="packages-duration">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                Duration
              </label>
              <select
                id="packages-duration"
                value={filters.duration}
                onChange={(e) => setFilters((prev) => ({ ...prev, duration: e.target.value }))}
                className="crm-packages-filter__control"
              >
                <option value="">All durations</option>
                {filterOptions.durations.map((duration) => (
                  <option key={duration} value={duration}>
                    {duration}
                  </option>
                ))}
              </select>
            </div>

            <div className="crm-packages-filter crm-packages-filter--price">
              <span className="crm-packages-filter__label">
                <IndianRupee className="h-3.5 w-3.5" aria-hidden />
                Price range
              </span>
              <div className="crm-packages-price-range">
                <input
                  type="number"
                  min={0}
                  value={filters.minPrice}
                  onChange={(e) => setFilters((prev) => ({ ...prev, minPrice: e.target.value }))}
                  placeholder="Min"
                  className="crm-packages-filter__control"
                  aria-label="Minimum price"
                />
                <span className="crm-packages-price-range__sep" aria-hidden>
                  –
                </span>
                <input
                  type="number"
                  min={0}
                  value={filters.maxPrice}
                  onChange={(e) => setFilters((prev) => ({ ...prev, maxPrice: e.target.value }))}
                  placeholder="Max"
                  className="crm-packages-filter__control"
                  aria-label="Maximum price"
                />
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <p className="crm-table-error">{error}</p>
        ) : loading ? (
          <CrmTableSkeleton rows={8} columns={6} />
        ) : items.length === 0 ? (
          <p className="crm-table-empty">No packages match your filters.</p>
        ) : (
          <>
            <div className="crm-table-wrap">
              <table className="crm-data-table min-w-[720px]">
                <thead>
                  <tr>
                    <th>Package</th>
                    <th>Destination</th>
                    <th>Duration</th>
                    <th>Price</th>
                    <th>Visibility</th>
                    <th>Slug</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="crm-packages-table__title">
                          <Package className="h-4 w-4 text-[var(--gold)]" aria-hidden />
                          <span>{item.title}</span>
                        </div>
                      </td>
                      <td>{item.destinationName}</td>
                      <td>{item.durationLabel}</td>
                      <td>₹{item.price.toLocaleString('en-IN')}</td>
                      <td>
                        {item.isPublished ? (
                          <span className="crm-packages-badge crm-packages-badge--website">
                            <Globe className="h-3.5 w-3.5" aria-hidden />
                            Website
                          </span>
                        ) : (
                          <span className="crm-packages-badge crm-packages-badge--internal">
                            <Lock className="h-3.5 w-3.5" aria-hidden />
                            Internal
                          </span>
                        )}
                      </td>
                      <td className="font-mono text-xs text-muted-foreground">{item.slug}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <CrmTablePagination
              rangeStart={total === 0 ? 0 : offset + 1}
              rangeEnd={Math.min(offset + items.length, total)}
              total={total}
              page={page}
              totalPages={pageCount}
              onPrev={() => setOffset(Math.max(0, offset - pageSize))}
              onNext={() => setOffset(offset + pageSize)}
              hasPrev={offset > 0}
              hasNext={offset + pageSize < total}
              loading={loading}
              label="Packages"
            />
            <p className="crm-packages-footnote">
              Showing {summary.pageCount} on this page · {summary.websiteCount} published on this page
            </p>
          </>
        )}
      </CrmTablePanel>
    </div>
  );
}
