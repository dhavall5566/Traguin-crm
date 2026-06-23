import {
  CRM_API_MAX_PAGE_SIZE,
  CRM_TABLE_PAGE_SIZE,
  type PaginatedResponse,
} from "@/lib/api/pagination";
import {
  crmListPageCacheKey,
  fetchCrmListPageCached,
} from "@/lib/api/crm-list-cache";
import { setCrmWorkspaceList } from "@/lib/api/crm-workspace-store";

export type ProgressiveListOptions<TApi, TItem> = {
  cachePrefix: string;
  fetchPage: (offset: number, limit: number) => Promise<PaginatedResponse<TApi>>;
  mapItem: (item: TApi) => TItem;
  /** First page size — defaults to table page size (20). */
  firstPageSize?: number;
  /** Background batch size — defaults to API max (100). */
  batchSize?: number;
  signal?: AbortSignal;
  force?: boolean;
  onFirstPage?: (items: TItem[], total: number) => void;
  onComplete?: (items: TItem[], total: number) => void;
};

/**
 * Fetch the first page, invoke callbacks, then load remaining pages in the background.
 * Returns the first page response for callers that need raw pagination metadata.
 */
export async function loadProgressiveCrmList<TApi, TItem>({
  cachePrefix,
  fetchPage,
  mapItem,
  firstPageSize = CRM_TABLE_PAGE_SIZE,
  batchSize = CRM_API_MAX_PAGE_SIZE,
  signal,
  force,
  onFirstPage,
  onComplete,
}: ProgressiveListOptions<TApi, TItem>): Promise<PaginatedResponse<TApi>> {
  const firstKey = crmListPageCacheKey(cachePrefix, 0, firstPageSize);
  const first = await fetchCrmListPageCached(
    firstKey,
    () => fetchPage(0, firstPageSize),
    { force },
  );

  if (signal?.aborted) return first;

  const firstMapped = first.items.map(mapItem);
  setCrmWorkspaceList(cachePrefix, firstMapped, first.total);
  onFirstPage?.(firstMapped, first.total);

  if (first.items.length >= first.total) {
    onComplete?.(firstMapped, first.total);
    return first;
  }

  void (async () => {
    const merged = [...first.items];
    let offset = merged.length;

    while (merged.length < first.total) {
      if (signal?.aborted) return;

      const pageKey = crmListPageCacheKey(cachePrefix, offset, batchSize);
      const page = await fetchCrmListPageCached(pageKey, () => fetchPage(offset, batchSize), {
        force,
      });

      if (signal?.aborted) return;

      if (page.items.length === 0) break;
      merged.push(...page.items);
      offset += page.items.length;
      const allMapped = merged.map(mapItem);
      setCrmWorkspaceList(cachePrefix, allMapped, first.total);
      onComplete?.(allMapped, first.total);

      if (merged.length >= first.total) break;
    }
  })();

  return first;
}
