"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { invalidateCrmListCache } from "@/lib/api/crm-list-cache";
import { getCrmWorkspaceList } from "@/lib/api/crm-workspace-store";
import { loadProgressiveCrmList } from "@/lib/api/progressive-list";
import type { PaginatedResponse } from "@/lib/api/pagination";

export type UseProgressiveCrmListOptions<TApi, TItem> = {
  cachePrefix: string;
  fetchPage: (offset: number, limit: number) => Promise<PaginatedResponse<TApi>>;
  mapItem: (item: TApi) => TItem;
  /** When false, skips fetching (e.g. SSR guard). Defaults to true. */
  enabled?: boolean;
  deps?: unknown[];
};

export function useProgressiveCrmList<TApi, TItem>({
  cachePrefix,
  fetchPage,
  mapItem,
  enabled = true,
  deps = [],
}: UseProgressiveCrmListOptions<TApi, TItem>) {
  const cached = getCrmWorkspaceList<TItem>(cachePrefix);
  const [items, setItems] = useState<TItem[]>(() => cached?.items ?? []);
  const [total, setTotal] = useState(() => cached?.total ?? 0);
  const [loading, setLoading] = useState(() => !cached);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchPageRef = useRef(fetchPage);
  const mapItemRef = useRef(mapItem);
  fetchPageRef.current = fetchPage;
  mapItemRef.current = mapItem;

  const depsKey = JSON.stringify(deps);

  const load = useCallback(
    async (force = false) => {
      if (!enabled) return;

      setError(null);
      const warm = !force ? getCrmWorkspaceList<TItem>(cachePrefix) : null;
      if (!warm) {
        setLoading(true);
      }
      setBackgroundLoading(false);

      const controller = new AbortController();

      try {
        await loadProgressiveCrmList({
          cachePrefix,
          fetchPage: (offset, limit) => fetchPageRef.current(offset, limit),
          mapItem: (item) => mapItemRef.current(item),
          signal: controller.signal,
          force,
          onFirstPage: (firstItems, firstTotal) => {
            setItems(firstItems);
            setTotal(firstTotal);
            setLoading(false);
            if (firstItems.length < firstTotal) {
              setBackgroundLoading(true);
            }
          },
          onComplete: (allItems, allTotal) => {
            setItems(allItems);
            setTotal(allTotal);
            setBackgroundLoading(false);
          },
        });
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : "Failed to load data");
          setLoading(false);
          setBackgroundLoading(false);
        }
      }

      return () => controller.abort();
    },
    [cachePrefix, enabled],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (cancelled) return;
      await load(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- depsKey encodes caller deps
  }, [load, depsKey]);

  const refresh = useCallback(async () => {
    invalidateCrmListCache(cachePrefix);
    await load(true);
  }, [cachePrefix, load]);

  const invalidate = useCallback(() => {
    invalidateCrmListCache(cachePrefix);
  }, [cachePrefix]);

  return {
    items,
    setItems,
    total,
    loading,
    backgroundLoading,
    error,
    refresh,
    invalidate,
  };
}
