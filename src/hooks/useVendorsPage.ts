"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createVendorPayout } from "@/lib/api/finance";
import {
  createVendor as createVendorApi,
  deleteVendor as deleteVendorApi,
  getVendor,
  mapVendorFromApi,
  updateVendor as updateVendorApi,
  type VendorCreateInput,
} from "@/lib/api/vendors";
import { CRM_API_DEFAULT_PAGE_SIZE } from "@/lib/api/pagination";
import type { Vendor } from "@/lib/store";

export function useVendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);
  const savingLockRef = useRef<string | null>(null);
  const vendorsRef = useRef(vendors);
  const hydratedVendorIdsRef = useRef<Set<string>>(new Set());
  vendorsRef.current = vendors;

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await import("@/lib/api/vendors").then((m) =>
          m.listVendors({ limit: CRM_API_DEFAULT_PAGE_SIZE }),
        );
        if (!cancelled) {
          hydratedVendorIdsRef.current.clear();
          setVendors(data.items.map(mapVendorFromApi));
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load vendors");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const addVendor = useCallback(
    async (input: VendorCreateInput) => {
      const apiVendor = await createVendorApi(input);
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
    await deleteVendorApi(vendorId);
    hydratedVendorIdsRef.current.delete(vendorId);
    setVendors((prev) => prev.filter((v) => v.id !== vendorId));
    setDirtyIds((prev) => {
      const next = new Set(prev);
      next.delete(vendorId);
      return next;
    });
  }, []);

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
    loading,
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
