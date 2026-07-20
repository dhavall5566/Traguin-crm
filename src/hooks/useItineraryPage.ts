"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listCustomers, mapCustomerFromApi } from "@/lib/api/customers";
import { CRM_CACHE, getCrmWorkspaceList } from "@/lib/api/crm-workspace-store";
import { bindCrmListFetch } from "@/lib/api/pagination";
import { loadProgressiveCrmList } from "@/lib/api/progressive-list";
import {
  applyItineraryRecord,
  computeItineraryTotalPrice,
  createItinerary as createItineraryApi,
  deleteItinerary as deleteItineraryApi,
  getItinerary,
  loadItineraryExtras,
  mergeItineraryExtras,
  newLocalId,
  updateItinerary as updateItineraryApi,
  type ItineraryCreateInput,
} from "@/lib/api/itineraries";
import type { Customer, Itinerary, ItineraryDay, ItineraryItem } from "@/lib/store";

function withRecalculatedTotal(itin: Itinerary): Itinerary {
  const computed = computeItineraryTotalPrice(itin);
  if (computed > 0) {
    return { ...itin, totalPrice: computed };
  }
  return itin;
}

export function useItineraryPage(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const cachedItineraries = getCrmWorkspaceList<Itinerary>(CRM_CACHE.itineraries);
  const cachedCustomers = getCrmWorkspaceList<Customer>(CRM_CACHE.customers);
  const hasWarmCache = Boolean(cachedItineraries || cachedCustomers);

  const [itineraries, setItineraries] = useState<Itinerary[]>(
    () => cachedItineraries?.items ?? [],
  );
  const [customers, setCustomers] = useState<Customer[]>(() => cachedCustomers?.items ?? []);
  const [loading, setLoading] = useState(() => !hasWarmCache);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const itinerariesRef = useRef(itineraries);
  const hydratedItineraryIdsRef = useRef<Set<string>>(new Set());
  const catalogLoadedRef = useRef(false);
  itinerariesRef.current = itineraries;

  const markDirty = useCallback((id: string) => {
    setDirtyIds((prev) => new Set(prev).add(id));
  }, []);

  const clearDirty = useCallback((id: string) => {
    setDirtyIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const replaceItineraryInState = useCallback(
    (apiItinerary: Parameters<typeof applyItineraryRecord>[0]) => {
      const extras = loadItineraryExtras();
      const record = applyItineraryRecord(apiItinerary, extras);
      hydratedItineraryIdsRef.current.add(record.id);
      setItineraries((prev) => {
        const idx = prev.findIndex((i) => i.id === record.id);
        if (idx === -1) return [record, ...prev];
        const next = [...prev];
        next[idx] = {
          ...record,
          proposalTheme: record.proposalTheme ?? prev[idx].proposalTheme,
          discountRate: record.discountRate ?? prev[idx].discountRate ?? 0,
        };
        return next;
      });
      return record;
    },
    [],
  );

  useEffect(() => {
    if (!enabled) {
      catalogLoadedRef.current = false;
      return;
    }
    if (catalogLoadedRef.current) return;
    catalogLoadedRef.current = true;

    let cancelled = false;
    const controller = new AbortController();
    let pendingBackground = 0;
    const warmCache = Boolean(
      getCrmWorkspaceList(CRM_CACHE.itineraries) ||
        getCrmWorkspaceList(CRM_CACHE.customers),
    );

    (async () => {
      if (!warmCache) setLoading(true);
      setBackgroundLoading(false);
      setError(null);
      try {
        const extras = loadItineraryExtras();
        const { listItineraries } = await import("@/lib/api/itineraries");

        await Promise.all([
          loadProgressiveCrmList<
            Awaited<ReturnType<typeof listItineraries>>["items"][number],
            Itinerary
          >({
            cachePrefix: CRM_CACHE.itineraries,
            fetchPage: bindCrmListFetch(listItineraries),
            mapItem: (item) => applyItineraryRecord(item, extras),
            signal: controller.signal,
            onFirstPage: (firstItems, firstTotal) => {
              if (cancelled) return;
              hydratedItineraryIdsRef.current.clear();
              setItineraries(firstItems);
              if (firstItems.length < firstTotal) {
                pendingBackground += 1;
                setBackgroundLoading(true);
              }
            },
            onComplete: (allItems) => {
              if (cancelled) return;
              setItineraries(allItems);
              pendingBackground = Math.max(0, pendingBackground - 1);
              if (pendingBackground === 0) setBackgroundLoading(false);
            },
          }),
          loadProgressiveCrmList({
            cachePrefix: CRM_CACHE.customers,
            fetchPage: bindCrmListFetch(listCustomers),
            mapItem: mapCustomerFromApi,
            signal: controller.signal,
            onFirstPage: (firstItems, firstTotal) => {
              if (cancelled) return;
              setCustomers(firstItems);
              if (firstItems.length < firstTotal) {
                pendingBackground += 1;
                setBackgroundLoading(true);
              }
            },
            onComplete: (allItems) => {
              if (cancelled) return;
              setCustomers(allItems);
              pendingBackground = Math.max(0, pendingBackground - 1);
              if (pendingBackground === 0) setBackgroundLoading(false);
            },
          }),
        ]);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load itineraries");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [enabled]);

  const mutateItinerary = useCallback(
    (itineraryId: string, mutator: (itin: Itinerary) => Itinerary) => {
      setItineraries((prev) =>
        prev.map((it) => (it.id === itineraryId ? withRecalculatedTotal(mutator(it)) : it)),
      );
      markDirty(itineraryId);
    },
    [markDirty],
  );

  const addItinerary = useCallback(
    async (input: ItineraryCreateInput & { proposalTheme?: Itinerary["proposalTheme"] }) => {
      const { proposalTheme, ...createInput } = input;
      const apiItinerary = await createItineraryApi(createInput);
      const record = replaceItineraryInState(apiItinerary);
      if (proposalTheme) {
        mergeItineraryExtras(record.id, { proposalTheme });
        setItineraries((prev) =>
          prev.map((it) => (it.id === record.id ? { ...it, proposalTheme } : it)),
        );
      }
      clearDirty(record.id);
      return record;
    },
    [clearDirty, replaceItineraryInState],
  );

  const updateItinerary = useCallback(
    (itineraryId: string, updates: Partial<Itinerary>) => {
      mutateItinerary(itineraryId, (it) => {
        const next = { ...it, ...updates };
        if (updates.proposalTheme !== undefined) {
          mergeItineraryExtras(itineraryId, { proposalTheme: updates.proposalTheme });
        }
        if (updates.discountRate !== undefined) {
          mergeItineraryExtras(itineraryId, { discountRate: updates.discountRate });
        }
        return next;
      });
    },
    [mutateItinerary],
  );

  const saveItinerary = useCallback(
    async (itineraryId: string, snapshot?: Itinerary) => {
      const snap = snapshot ?? itinerariesRef.current.find((i) => i.id === itineraryId);
      if (!snap) throw new Error("Itinerary not found");
      const withTotal = withRecalculatedTotal(snap);
      const apiItinerary = await updateItineraryApi(itineraryId, {
        title: withTotal.title,
        description: withTotal.description,
        startDate: withTotal.startDate,
        endDate: withTotal.endDate,
        customerId: withTotal.customerId,
        status: withTotal.status,
        markupMargin: withTotal.markupMargin,
        taxRate: withTotal.taxRate,
        isTemplate: withTotal.isTemplate,
        totalPrice: withTotal.totalPrice,
        days: withTotal.days,
      });
      replaceItineraryInState(apiItinerary);
      clearDirty(itineraryId);
      return applyItineraryRecord(apiItinerary, loadItineraryExtras());
    },
    [clearDirty, replaceItineraryInState],
  );

  const deleteItinerary = useCallback(async (itineraryId: string) => {
    await deleteItineraryApi(itineraryId);
    hydratedItineraryIdsRef.current.delete(itineraryId);
    setItineraries((prev) => prev.filter((it) => it.id !== itineraryId));
    setDirtyIds((prev) => {
      const next = new Set(prev);
      next.delete(itineraryId);
      return next;
    });
  }, []);

  const addItineraryDay = useCallback(
    (itineraryId: string, title: string, description: string) => {
      let newDayId = "";
      mutateItinerary(itineraryId, (it) => {
        const existingDays = it.days ?? [];
        const nextDayNum = existingDays.length + 1;
        newDayId = newLocalId("day");
        const newDay: ItineraryDay = {
          id: newDayId,
          dayNumber: nextDayNum,
          title,
          description,
          items: [],
        };
        return { ...it, days: [...existingDays, newDay] };
      });
      return newDayId;
    },
    [mutateItinerary],
  );

  const updateItineraryDay = useCallback(
    (itineraryId: string, dayId: string, updates: Partial<ItineraryDay>) => {
      mutateItinerary(itineraryId, (it) => ({
        ...it,
        days: (it.days ?? []).map((d) => (d.id === dayId ? { ...d, ...updates } : d)),
      }));
    },
    [mutateItinerary],
  );

  const deleteItineraryDay = useCallback(
    (itineraryId: string, dayId: string) => {
      mutateItinerary(itineraryId, (it) => {
        const filteredDays = (it.days ?? []).filter((d) => d.id !== dayId);
        const reorderedDays = filteredDays.map((d, index) => ({
          ...d,
          dayNumber: index + 1,
        }));
        return { ...it, days: reorderedDays };
      });
    },
    [mutateItinerary],
  );

  const addItineraryItem = useCallback(
    (itineraryId: string, dayId: string, itemData: Omit<ItineraryItem, "id">) => {
      mutateItinerary(itineraryId, (it) => ({
        ...it,
        days: (it.days ?? []).map((d) =>
          d.id === dayId
            ? {
                ...d,
                items: [...(d.items ?? []), { ...itemData, id: newLocalId("item") }],
              }
            : d,
        ),
      }));
    },
    [mutateItinerary],
  );

  const updateItineraryItem = useCallback(
    (
      itineraryId: string,
      dayId: string,
      itemId: string,
      updates: Partial<ItineraryItem>,
    ) => {
      mutateItinerary(itineraryId, (it) => ({
        ...it,
        days: (it.days ?? []).map((d) =>
          d.id === dayId
            ? {
                ...d,
                items: (d.items ?? []).map((i) =>
                  i.id === itemId ? { ...i, ...updates } : i,
                ),
              }
            : d,
        ),
      }));
    },
    [mutateItinerary],
  );

  const deleteItineraryItem = useCallback(
    (itineraryId: string, dayId: string, itemId: string) => {
      mutateItinerary(itineraryId, (it) => ({
        ...it,
        days: (it.days ?? []).map((d) =>
          d.id === dayId
            ? { ...d, items: (d.items ?? []).filter((i) => i.id !== itemId) }
            : d,
        ),
      }));
    },
    [mutateItinerary],
  );

  const reorderItineraryDays = useCallback(
    (itineraryId: string, days: ItineraryDay[]) => {
      mutateItinerary(itineraryId, (it) => ({
        ...it,
        days: days.map((d, index) => ({ ...d, dayNumber: index + 1 })),
      }));
    },
    [mutateItinerary],
  );

  const hydrateItineraryDetail = useCallback(async (itineraryId: string): Promise<Itinerary | null> => {
    if (!itineraryId) return null;

    const current = itinerariesRef.current.find((i) => i.id === itineraryId);
    if (current && (current.days?.length ?? 0) > 0) {
      hydratedItineraryIdsRef.current.add(itineraryId);
      return current;
    }

    try {
      const apiItinerary = await getItinerary(itineraryId);
      return replaceItineraryInState(apiItinerary);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load itinerary";
      const missing =
        /not found/i.test(message) || message.includes("404") || message.includes("(404)");
      if (!missing) throw err;

      hydratedItineraryIdsRef.current.delete(itineraryId);
      setItineraries((prev) => prev.filter((it) => it.id !== itineraryId));
      setDirtyIds((prev) => {
        const next = new Set(prev);
        next.delete(itineraryId);
        return next;
      });
      setError("That itinerary is no longer available. It may have been deleted.");
      return null;
    }
  }, [replaceItineraryInState]);

  return {
    itineraries,
    customers,
    loading,
    backgroundLoading,
    error,
    dirtyIds,
    addItinerary,
    updateItinerary,
    saveItinerary,
    deleteItinerary,
    addItineraryDay,
    updateItineraryDay,
    deleteItineraryDay,
    addItineraryItem,
    updateItineraryItem,
    deleteItineraryItem,
    reorderItineraryDays,
    hydrateItineraryDetail,
  };
}
