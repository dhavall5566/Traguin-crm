'use client';

import { useEffect, useMemo, useState } from 'react';

import { CRM_TABLE_PAGE_SIZE } from '@/lib/api/pagination';

export type ClientPaginationResult<T> = {
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  total: number;
  totalPages: number;
  pageItems: T[];
  rangeStart: number;
  rangeEnd: number;
  hasPrev: boolean;
  hasNext: boolean;
  goPrev: () => void;
  goNext: () => void;
};

/**
 * Client-side pagination for filtered in-memory CRM tables.
 * Resets to page 1 when `resetDeps` change (search, filters, tab switches, etc.).
 */
export function useClientPagination<T>(
  items: T[],
  pageSize: number = CRM_TABLE_PAGE_SIZE,
  resetDeps: unknown[] = [],
): ClientPaginationResult<T> {
  const [page, setPage] = useState(1);
  const resetKey = useMemo(() => JSON.stringify(resetDeps), [resetDeps]);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    setPage(1);
  }, [total, pageSize, resetKey]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const offset = (safePage - 1) * pageSize;

  const pageItems = useMemo(
    () => items.slice(offset, offset + pageSize),
    [items, offset, pageSize],
  );

  return {
    page: safePage,
    setPage,
    pageSize,
    total,
    totalPages,
    pageItems,
    rangeStart: total === 0 ? 0 : offset + 1,
    rangeEnd: Math.min(offset + pageSize, total),
    hasPrev: safePage > 1,
    hasNext: safePage < totalPages,
    goPrev: () => setPage((p) => Math.max(1, p - 1)),
    goNext: () => setPage((p) => Math.min(totalPages, p + 1)),
  };
}
