'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type CrmTablePaginationProps = {
  rangeStart: number;
  rangeEnd: number;
  total: number;
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  loading?: boolean;
  backgroundLoading?: boolean;
  /** Optional label for screen readers / aria */
  label?: string;
};

export function CrmTablePagination({
  rangeStart,
  rangeEnd,
  total,
  page,
  totalPages,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  loading = false,
  backgroundLoading = false,
  label = 'Table',
}: CrmTablePaginationProps) {
  if (total === 0) {
    return null;
  }

  return (
    <div className="crm-table-pagination" aria-label={`${label} pagination`}>
      <p className="crm-table-pagination__summary">
        Showing {rangeStart}–{rangeEnd} of {total}
        <span className="crm-table-pagination__sep" aria-hidden>
          ·
        </span>
        Page {page} of {totalPages}
        {backgroundLoading ? (
          <span className="crm-table-pagination__sync" aria-live="polite">
            · Syncing…
          </span>
        ) : null}
      </p>
      <div className="crm-table-pagination__actions">
        <button
          type="button"
          className="crm-table-pagination__btn"
          onClick={onPrev}
          disabled={!hasPrev || loading}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          Previous
        </button>
        <button
          type="button"
          className="crm-table-pagination__btn"
          onClick={onNext}
          disabled={!hasNext || loading}
          aria-label="Next page"
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
