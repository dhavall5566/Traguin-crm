"use client";

import { useCallback, useEffect, useState } from "react";
import {
  appendCustomerDocument,
  createCustomer,
  deleteCustomer as deleteCustomerApi,
  mapCustomerFromApi,
  updateCustomer as updateCustomerApi,
  type CustomerCreateInput,
  type CustomerUpdateInput,
} from "@/lib/api/customers";
import { CRM_API_DEFAULT_PAGE_SIZE } from "@/lib/api/pagination";
import type { Customer } from "@/lib/store";

export function useCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshCustomers = useCallback(async () => {
    setError(null);
    const { listCustomers } = await import("@/lib/api/customers");
    const data = await listCustomers({ limit: CRM_API_DEFAULT_PAGE_SIZE });
    setCustomers(data.items.map(mapCustomerFromApi));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { listCustomers } = await import("@/lib/api/customers");
        const data = await listCustomers({ limit: CRM_API_DEFAULT_PAGE_SIZE });
        if (!cancelled) {
          setCustomers(data.items.map(mapCustomerFromApi));
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load customers");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const replaceCustomerInState = useCallback((apiCustomer: Parameters<typeof mapCustomerFromApi>[0]) => {
    const record = mapCustomerFromApi(apiCustomer);
    setCustomers((prev) => {
      const idx = prev.findIndex((c) => c.id === record.id);
      if (idx === -1) return [record, ...prev];
      const next = [...prev];
      next[idx] = record;
      return next;
    });
    return record;
  }, []);

  const addCustomer = useCallback(
    async (input: CustomerCreateInput) => {
      const apiCustomer = await createCustomer(input);
      return replaceCustomerInState(apiCustomer);
    },
    [replaceCustomerInState],
  );

  const updateCustomer = useCallback(
    async (customerId: string, updates: CustomerUpdateInput) => {
      const apiCustomer = await updateCustomerApi(customerId, updates);
      return replaceCustomerInState(apiCustomer);
    },
    [replaceCustomerInState],
  );

  const uploadCustomerDoc = useCallback(
    async (customerId: string, doc: { name: string; category: string; size: string }) => {
      const apiCustomer = await appendCustomerDocument(customerId, doc);
      return replaceCustomerInState(apiCustomer);
    },
    [replaceCustomerInState],
  );

  const deleteCustomer = useCallback(async (customerId: string) => {
    await deleteCustomerApi(customerId);
    setCustomers((prev) => prev.filter((c) => c.id !== customerId));
  }, []);

  return {
    customers,
    loading,
    error,
    refreshCustomers,
    addCustomer,
    updateCustomer,
    uploadCustomerDoc,
    deleteCustomer,
  };
}
