"use client";

import { useCallback, useEffect } from "react";
import {
  appendCustomerDocument,
  createCustomer,
  deleteCustomer as deleteCustomerApi,
  listCustomers,
  mapCustomerFromApi,
  updateCustomer as updateCustomerApi,
  type CustomerCreateInput,
  type CustomerUpdateInput,
} from "@/lib/api/customers";
import { onCustomerWorkspaceUpsert } from "@/lib/api/customer-workspace-sync";
import { invalidateCrmListCache } from "@/lib/api/crm-list-cache";
import {
  CRM_CACHE,
  patchCrmWorkspaceItem,
  prependCrmWorkspaceItem,
  removeCrmWorkspaceItem,
} from "@/lib/api/crm-workspace-store";
import { bindCrmListFetch } from "@/lib/api/pagination";
import { useProgressiveCrmList } from "@/hooks/useProgressiveCrmList";

export function useCustomersPage() {
  const {
    items: customers,
    setItems: setCustomers,
    total,
    loading,
    backgroundLoading,
    error,
    refresh,
  } = useProgressiveCrmList({
    cachePrefix: CRM_CACHE.customers,
    fetchPage: bindCrmListFetch(listCustomers),
    mapItem: mapCustomerFromApi,
  });

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
  }, [setCustomers]);

  useEffect(() => {
    return onCustomerWorkspaceUpsert((customer) => {
      setCustomers((prev) => {
        if (prev.some((row) => row.id === customer.id)) return prev;
        return [customer, ...prev];
      });
    });
  }, [setCustomers]);

  const addCustomer = useCallback(
    async (input: CustomerCreateInput) => {
      const apiCustomer = await createCustomer(input);
      invalidateCrmListCache(CRM_CACHE.customers);
      return replaceCustomerInState(apiCustomer);
    },
    [replaceCustomerInState],
  );

  const updateCustomer = useCallback(
    async (customerId: string, updates: CustomerUpdateInput) => {
      const snapshot = customers.find((c) => c.id === customerId);
      if (snapshot) {
        setCustomers((prev) =>
          prev.map((c) => (c.id === customerId ? { ...c, ...updates } : c)),
        );
        patchCrmWorkspaceItem(CRM_CACHE.customers, customerId, updates);
      }

      try {
        const apiCustomer = await updateCustomerApi(customerId, updates);
        invalidateCrmListCache(CRM_CACHE.customers);
        return replaceCustomerInState(apiCustomer);
      } catch (error) {
        if (snapshot) {
          setCustomers((prev) =>
            prev.map((c) => (c.id === customerId ? snapshot : c)),
          );
          patchCrmWorkspaceItem(CRM_CACHE.customers, customerId, snapshot);
        }
        throw error;
      }
    },
    [customers, replaceCustomerInState, setCustomers],
  );

  const uploadCustomerDoc = useCallback(
    async (customerId: string, doc: { name: string; category: string; size: string }) => {
      const apiCustomer = await appendCustomerDocument(customerId, doc);
      return replaceCustomerInState(apiCustomer);
    },
    [replaceCustomerInState],
  );

  const deleteCustomer = useCallback(async (customerId: string) => {
    const snapshot = customers.find((c) => c.id === customerId);
    setCustomers((prev) => prev.filter((c) => c.id !== customerId));
    removeCrmWorkspaceItem(CRM_CACHE.customers, customerId);

    try {
      await deleteCustomerApi(customerId);
      invalidateCrmListCache(CRM_CACHE.customers);
    } catch (error) {
      if (snapshot) {
        setCustomers((prev) => [snapshot, ...prev]);
        prependCrmWorkspaceItem(CRM_CACHE.customers, snapshot);
      }
      throw error;
    }
  }, [customers, setCustomers]);

  const refreshCustomers = useCallback(async () => {
    await refresh();
  }, [refresh]);

  return {
    customers,
    total,
    loading,
    backgroundLoading,
    error,
    refreshCustomers,
    addCustomer,
    updateCustomer,
    uploadCustomerDoc,
    deleteCustomer,
  };
}
