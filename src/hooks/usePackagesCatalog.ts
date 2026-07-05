"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getCmsPackage,
  getCmsPackageFilters,
  listCmsPackages,
  mapPackageListFromApi,
  type CmsPackageFilters,
  type CmsPackageListRecord,
} from "@/lib/api/packages";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const PAGE_SIZE = 50;

export type PackageCatalogFilters = {
  destinationId: string;
  duration: string;
  minPrice: string;
  maxPrice: string;
};

export const EMPTY_PACKAGE_CATALOG_FILTERS: PackageCatalogFilters = {
  destinationId: "",
  duration: "",
  minPrice: "",
  maxPrice: "",
};

function parseOptionalPrice(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function usePackagesCatalog(options?: {
  published?: boolean;
  filters?: PackageCatalogFilters;
}) {
  const [items, setItems] = useState<CmsPackageListRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const debouncedMinPrice = useDebouncedValue(options?.filters?.minPrice ?? "");
  const debouncedMaxPrice = useDebouncedValue(options?.filters?.maxPrice ?? "");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterOptions, setFilterOptions] = useState<CmsPackageFilters>({
    destinations: [],
    durations: [],
  });

  const filters = options?.filters ?? EMPTY_PACKAGE_CATALOG_FILTERS;

  useEffect(() => {
    let cancelled = false;
    void getCmsPackageFilters()
      .then((data) => {
        if (!cancelled) setFilterOptions(data);
      })
      .catch(() => {
        if (!cancelled) setFilterOptions({ destinations: [], durations: [] });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listCmsPackages({
        q: debouncedSearch || undefined,
        published: options?.published,
        destinationId: filters.destinationId || undefined,
        duration: filters.duration || undefined,
        minPrice: parseOptionalPrice(debouncedMinPrice),
        maxPrice: parseOptionalPrice(debouncedMaxPrice),
        limit: PAGE_SIZE,
        offset,
      });
      setItems(response.items.map(mapPackageListFromApi));
      setTotal(response.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load packages.");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    debouncedSearch,
    debouncedMinPrice,
    debouncedMaxPrice,
    offset,
    options?.published,
    filters.destinationId,
    filters.duration,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setOffset(0);
  }, [
    debouncedSearch,
    debouncedMinPrice,
    debouncedMaxPrice,
    options?.published,
    filters.destinationId,
    filters.duration,
  ]);

  return {
    items,
    total,
    search,
    setSearch,
    offset,
    setOffset,
    pageSize: PAGE_SIZE,
    loading,
    error,
    filterOptions,
    refresh: load,
  };
}

export function useCmsPackageSummary(packageId: string | undefined) {
  const [summary, setSummary] = useState<CmsPackageListRecord | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!packageId) {
      setSummary(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void getCmsPackage(packageId)
      .then((pkg) => {
        if (cancelled) return;
        setSummary(mapPackageListFromApi(pkg));
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [packageId]);

  return { summary, loading };
}

function resolveDestinationId(
  travelDestination: string,
  destinations: { id: string; name: string }[],
): string | undefined {
  const query = travelDestination.trim().toLowerCase();
  if (!query) return undefined;

  const exact = destinations.find((row) => row.name.trim().toLowerCase() === query);
  if (exact) return exact.id;

  const partial = destinations.find((row) => {
    const name = row.name.trim().toLowerCase();
    return name.includes(query) || query.includes(name);
  });
  return partial?.id;
}

/** CMS packages matching the lead Details → Destination field (name or id). */
export function usePackagesForDestination(travelDestination: string | undefined) {
  const [items, setItems] = useState<CmsPackageListRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [destinations, setDestinations] = useState<{ id: string; name: string }[]>([]);
  const debouncedDestination = useDebouncedValue((travelDestination ?? "").trim());

  useEffect(() => {
    let cancelled = false;
    void getCmsPackageFilters()
      .then((data) => {
        if (!cancelled) setDestinations(data.destinations);
      })
      .catch(() => {
        if (!cancelled) setDestinations([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const query = debouncedDestination;
    if (!query) {
      setItems([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const destinationId = resolveDestinationId(query, destinations);

    void listCmsPackages({
      q: destinationId ? undefined : query,
      destinationId,
      limit: 100,
    })
      .then((response) => {
        if (cancelled) return;
        setItems(response.items.map(mapPackageListFromApi));
      })
      .catch((err) => {
        if (cancelled) return;
        setItems([]);
        setError(err instanceof Error ? err.message : "Failed to load packages");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedDestination, destinations]);

  return {
    packages: items,
    loading,
    error,
    hasDestination: Boolean(debouncedDestination),
    destinationQuery: debouncedDestination,
  };
}
