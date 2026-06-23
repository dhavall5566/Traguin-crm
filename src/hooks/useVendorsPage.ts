"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createVendorPayout } from "@/lib/api/finance";
import { invalidateCrmListCache } from "@/lib/api/crm-list-cache";
import {
  CRM_CACHE,
  getCrmWorkspaceList,
  prependCrmWorkspaceItem,
  removeCrmWorkspaceItem,
} from "@/lib/api/crm-workspace-store";
import { loadProgressiveCrmList } from "@/lib/api/progressive-list";
import { bindCrmListFetch } from "@/lib/api/pagination";
import {
  createVendor as createVendorApi,
  deleteVendor as deleteVendorApi,
  getVendor,
  listVendors,
  mapVendorFromApi,
  updateVendor as updateVendorApi,
  type VendorCreateInput,
} from "@/lib/api/vendors";
import type { Vendor } from "@/lib/store";

export function useVendorsPage() {
  const cached = getCrmWorkspaceList<Vendor>(CRM_CACHE.vendors);
  const [vendors, setVendors] = useState<Vendor[]>(() => cached?.items ?? []);
  const [total, setTotal] = useState(() => cached?.total ?? 0);
  const [loading, setLoading] = useState(() => !cached);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);
  const savingLockRef = useRef<string | null>(null);
  const vendorsRef = useRef(vendors);
  const hydratedVendorIdsRef = useRef<Set<string>>(new Set());
  vendorsRef.current = vendors;

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      const warm = getCrmWorkspaceList<Vendor>(CRM_CACHE.vendors);
      if (!warm) setLoading(true);
      setBackgroundLoading(false);
      setError(null);
      try {
        await loadProgressiveCrmList({
          cachePrefix: CRM_CACHE.vendors,
          fetchPage: bindCrmListFetch(listVendors),
          mapItem: mapVendorFromApi,
          signal: controller.signal,
          onFirstPage: (firstItems, firstTotal) => {
            if (cancelled) return;
            hydratedVendorIdsRef.current.clear();
            setVendors(firstItems);
            setTotal(firstTotal);
            setLoading(false);
            if (firstItems.length < firstTotal) setBackgroundLoading(true);
          },
          onComplete: (allItems, allTotal) => {
            if (cancelled) return;
            setVendors(allItems);
            setTotal(allTotal);
            setBackgroundLoading(false);
          },
        });
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load vendors");
          setLoading(false);
          setBackgroundLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

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

  const replaceVendorInState = useCallback((apiVendor: Parameters<typeof mapVendorFromApi>[0]) => {
    const record = mapVendorFromApi(apiVendor);
    hydratedVendorIdsRef.current.add(record.id);
    setVendors((prev) => {
      const idx = prev.findIndex((v) => v.id === record.id);
      if (idx === -1) return [record, ...prev];
      const next = [...prev];
      next[idx] = record;
      return next;
    });
    return record;
  }, []);

  const addVendor = useCallback(
    async (input: VendorCreateInput) => {
      const apiVendor = await createVendorApi(input);
      invalidateCrmListCache(CRM_CACHE.vendors);
      const record = replaceVendorInState(apiVendor);
      clearDirty(record.id);
      return record;
    },
    [clearDirty, replaceVendorInState],
  );

  const updateVendorLocal = useCallback(
    (vendorId: string, updates: Partial<Vendor>) => {
      setVendors((prev) =>
        prev.map((v) => (v.id === vendorId ? { ...v, ...updates } : v)),
      );
      markDirty(vendorId);
    },
    [markDirty],
  );

  const saveVendor = useCallback(
    async (vendorId: string, snapshot?: Vendor) => {
      if (savingLockRef.current === vendorId) return;
      savingLockRef.current = vendorId;
      const snap = snapshot ?? vendorsRef.current.find((v) => v.id === vendorId);
      if (!snap) {
        savingLockRef.current = null;
        throw new Error("Vendor not found");
      }
      setSavingId(vendorId);
      try {
        const apiVendor = await updateVendorApi(vendorId, {
          name: snap.name,
          type: snap.type,
          email: snap.email,
          phone: snap.phone,
          address: snap.address,
          ledgerBalance: snap.ledgerBalance,
          rates: snap.rates ?? [],
        });
        invalidateCrmListCache(CRM_CACHE.vendors);
        replaceVendorInState(apiVendor);
        clearDirty(vendorId);
        return mapVendorFromApi(apiVendor);
      } finally {
        savingLockRef.current = null;
        setSavingId(null);
      }
    },
    [clearDirty, replaceVendorInState],
  );

  const deleteVendor = useCallback(async (vendorId: string) => {
    const snapshot = vendors.find((v) => v.id === vendorId);
    hydratedVendorIdsRef.current.delete(vendorId);
    setVendors((prev) => prev.filter((v) => v.id !== vendorId));
    setDirtyIds((prev) => {
      const next = new Set(prev);
      next.delete(vendorId);
      return next;
    });
    removeCrmWorkspaceItem(CRM_CACHE.vendors, vendorId);

    try {
      await deleteVendorApi(vendorId);
      invalidateCrmListCache(CRM_CACHE.vendors);
    } catch (error) {
      if (snapshot) {
        setVendors((prev) => [snapshot, ...prev]);
        prependCrmWorkspaceItem(CRM_CACHE.vendors, snapshot);
      }
      throw error;
    }
  }, [vendors]);

  const recordVendorPayout = useCallback(
    async (vendorId: string, amount: number) => {
      await createVendorPayout({ vendorId, amount });
      const apiVendor = await getVendor(vendorId);
      replaceVendorInState(apiVendor);
    },
    [replaceVendorInState],
  );

  const hydrateVendorDetail = useCallback(async (vendorId: string) => {
    if (!vendorId || hydratedVendorIdsRef.current.has(vendorId)) return;
    const current = vendorsRef.current.find((v) => v.id === vendorId);
    if (current && (current.rates?.length ?? 0) > 0) {
      hydratedVendorIdsRef.current.add(vendorId);
      return;
    }
    const apiVendor = await getVendor(vendorId);
    replaceVendorInState(apiVendor);
  }, [replaceVendorInState]);

  return {
    vendors,
    total,
    loading,
    backgroundLoading,
    error,
    dirtyIds,
    savingId,
    addVendor,
    updateVendorLocal,
    saveVendor,
    deleteVendor,
    recordVendorPayout,
    hydrateVendorDetail,
  };
}
