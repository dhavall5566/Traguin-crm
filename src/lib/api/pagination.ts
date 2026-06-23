/**
 * CRM list endpoints enforce `limit <= 100` (see api/dependencies/pagination.py).
 * Import these instead of hardcoding limits in hooks or pages.
 */
export const CRM_API_MAX_PAGE_SIZE = 100;

/** Default page size for dashboard list views (single page, max allowed). */
export const CRM_API_DEFAULT_PAGE_SIZE = CRM_API_MAX_PAGE_SIZE;

/** Clamp a requested page size to the backend maximum. */
export function clampListLimit(limit?: number): number {
  if (limit == null || limit <= 0) return CRM_API_DEFAULT_PAGE_SIZE;
  return Math.min(Math.floor(limit), CRM_API_MAX_PAGE_SIZE);
}

export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

/** Page through a CRM list endpoint until all rows are fetched. */
export async function fetchAllPaginated<T>(
  fetchPage: (offset: number, limit: number) => Promise<PaginatedResponse<T>>,
  pageSize: number = CRM_API_MAX_PAGE_SIZE,
): Promise<T[]> {
  const size = clampListLimit(pageSize);
  const all: T[] = [];
  let offset = 0;
  while (true) {
    const page = await fetchPage(offset, size);
    all.push(...page.items);
    if (page.items.length < size || all.length >= page.total) break;
    offset += size;
  }
  return all;
}
