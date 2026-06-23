"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listCustomers, mapCustomerFromApi } from "@/lib/api/customers";
import { CRM_API_DEFAULT_PAGE_SIZE } from "@/lib/api/pagination";
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
  return {
    ...itin,
    totalPrice: computeItineraryTotalPrice(itin),
  };
}

export function useItineraryPage() {
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const itinerariesRef = useRef(itineraries);
  const hydratedItineraryIdsRef = useRef<Set<string>>(new Set());
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
        };
        return next;
      });
      return record;
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const extras = loadItineraryExtras();
        const [itinData, customerData] = await Promise.all([
          import("@/lib/api/itineraries").then((m) =>
            m.listItineraries({ limit: CRM_API_DEFAULT_PAGE_SIZE }),
          ),
          listCustomers({ limit: CRM_API_DEFAULT_PAGE_SIZE }),
        ]);
        if (cancelled) return;
        hydratedItineraryIdsRef.current.clear();
        setCustomers(customerData.items.map(mapCustomerFromApi));
        setItineraries(itinData.items.map((item) => applyItineraryRecord(item, extras)));
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
    };
  }, []);

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

  const hydrateItineraryDetail = useCallback(async (itineraryId: string) => {
    if (!itineraryId || hydratedItineraryIdsRef.current.has(itineraryId)) return;
    const current = itinerariesRef.current.find((i) => i.id === itineraryId);
    if (current && (current.days?.length ?? 0) > 0) {
      hydratedItineraryIdsRef.current.add(itineraryId);
      return;
    }
    const apiItinerary = await getItinerary(itineraryId);
    replaceItineraryInState(apiItinerary);
  }, [replaceItineraryInState]);

  return {
    itineraries,
    customers,
    loading,
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
