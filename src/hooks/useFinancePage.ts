"use client";

import { useCallback, useEffect, useState } from "react";
import { listBookings, mapBookingFromApi } from "@/lib/api/bookings";
import { listCustomers, mapCustomerFromApi } from "@/lib/api/customers";
import { invalidateCrmListCache } from "@/lib/api/crm-list-cache";
import {
  CRM_CACHE,
  getCrmWorkspaceList,
  prependCrmWorkspaceItem,
  removeCrmWorkspaceItem,
} from "@/lib/api/crm-workspace-store";
import {
  createExpense as createExpenseApi,
  createInvoice as createInvoiceApi,
  createPayment as createPaymentApi,
  deleteExpense as deleteExpenseApi,
  getInvoice,
  listExpenses,
  listInvoices,
  listPayments,
  listVendorPayouts,
  mapExpenseFromApi,
  mapInvoiceFromApi,
  mapPaymentFromApi,
  mapVendorPayoutFromApi,
  updateExpense as updateExpenseApi,
  updateInvoice as updateInvoiceApi,
  type ExpenseCreateInput,
  type InvoiceCreateInput,
  type InvoiceUpdateInput,
} from "@/lib/api/finance";
import { listItineraries, mapItineraryFromApi } from "@/lib/api/itineraries";
import { loadProgressiveCrmList } from "@/lib/api/progressive-list";
import { bindCrmListFetch } from "@/lib/api/pagination";
import { listVendors, mapVendorFromApi } from "@/lib/api/vendors";
import type { Booking, Customer, Expense, Invoice, Itinerary, Payment, Vendor, VendorPayout } from "@/lib/store";

export function useFinancePage() {
  const cachedInvoices = getCrmWorkspaceList<Invoice>(CRM_CACHE.invoices);
  const cachedPayments = getCrmWorkspaceList<Payment>(CRM_CACHE.payments);
  const cachedExpenses = getCrmWorkspaceList<Expense>(CRM_CACHE.expenses);
  const cachedPayouts = getCrmWorkspaceList<VendorPayout>(CRM_CACHE.vendorPayouts);
  const cachedBookings = getCrmWorkspaceList<Booking>(CRM_CACHE.bookings);
  const cachedCustomers = getCrmWorkspaceList<Customer>(CRM_CACHE.customers);
  const cachedItineraries = getCrmWorkspaceList<Itinerary>(CRM_CACHE.itineraries);
  const cachedVendors = getCrmWorkspaceList<Vendor>(CRM_CACHE.vendors);

  const hasWarmCache =
    cachedInvoices ||
    cachedPayments ||
    cachedExpenses ||
    cachedPayouts ||
    cachedBookings ||
    cachedCustomers ||
    cachedItineraries ||
    cachedVendors;

  const [invoices, setInvoices] = useState<Invoice[]>(() => cachedInvoices?.items ?? []);
  const [payments, setPayments] = useState<Payment[]>(() => cachedPayments?.items ?? []);
  const [expenses, setExpenses] = useState<Expense[]>(() => cachedExpenses?.items ?? []);
  const [vendorPayouts, setVendorPayouts] = useState<VendorPayout[]>(
    () => cachedPayouts?.items ?? [],
  );
  const [bookings, setBookings] = useState<Booking[]>(() => cachedBookings?.items ?? []);
  const [customers, setCustomers] = useState<Customer[]>(() => cachedCustomers?.items ?? []);
  const [itineraries, setItineraries] = useState<Itinerary[]>(
    () => cachedItineraries?.items ?? [],
  );
  const [vendors, setVendors] = useState<Vendor[]>(() => cachedVendors?.items ?? []);
  const [loading, setLoading] = useState(() => !hasWarmCache);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async (force = false) => {
    setError(null);
    if (force) {
      invalidateCrmListCache(CRM_CACHE.invoices);
      invalidateCrmListCache(CRM_CACHE.payments);
      invalidateCrmListCache(CRM_CACHE.expenses);
      invalidateCrmListCache(CRM_CACHE.vendorPayouts);
      invalidateCrmListCache(CRM_CACHE.bookings);
      invalidateCrmListCache(CRM_CACHE.customers);
      invalidateCrmListCache(CRM_CACHE.itineraries);
      invalidateCrmListCache(CRM_CACHE.vendors);
    }

    if (!force && hasWarmCache) {
      setLoading(false);
    } else {
      setLoading(true);
    }
    setBackgroundLoading(false);

    const controller = new AbortController();
    let pendingBackground = 0;

    const trackFirst = <T,>(setter: (items: T[]) => void) => (items: T[], total: number) => {
      setter(items);
      if (items.length < total) {
        pendingBackground += 1;
        setBackgroundLoading(true);
      }
    };

    const trackComplete = <T,>(setter: (items: T[]) => void) => (items: T[]) => {
      setter(items);
      pendingBackground = Math.max(0, pendingBackground - 1);
      if (pendingBackground === 0) setBackgroundLoading(false);
    };

    try {
      await Promise.all([
        loadProgressiveCrmList({
          cachePrefix: CRM_CACHE.invoices,
          fetchPage: bindCrmListFetch(listInvoices),
          mapItem: mapInvoiceFromApi,
          signal: controller.signal,
          force,
          onFirstPage: trackFirst(setInvoices),
          onComplete: trackComplete(setInvoices),
        }),
        loadProgressiveCrmList({
          cachePrefix: CRM_CACHE.payments,
          fetchPage: bindCrmListFetch(listPayments),
          mapItem: mapPaymentFromApi,
          signal: controller.signal,
          force,
          onFirstPage: trackFirst(setPayments),
          onComplete: trackComplete(setPayments),
        }),
        loadProgressiveCrmList({
          cachePrefix: CRM_CACHE.expenses,
          fetchPage: bindCrmListFetch(listExpenses),
          mapItem: mapExpenseFromApi,
          signal: controller.signal,
          force,
          onFirstPage: trackFirst(setExpenses),
          onComplete: trackComplete(setExpenses),
        }),
        loadProgressiveCrmList({
          cachePrefix: CRM_CACHE.vendorPayouts,
          fetchPage: bindCrmListFetch(listVendorPayouts),
          mapItem: mapVendorPayoutFromApi,
          signal: controller.signal,
          force,
          onFirstPage: trackFirst(setVendorPayouts),
          onComplete: trackComplete(setVendorPayouts),
        }),
        loadProgressiveCrmList({
          cachePrefix: CRM_CACHE.bookings,
          fetchPage: bindCrmListFetch(listBookings),
          mapItem: mapBookingFromApi,
          signal: controller.signal,
          force,
          onFirstPage: trackFirst(setBookings),
          onComplete: trackComplete(setBookings),
        }),
        loadProgressiveCrmList({
          cachePrefix: CRM_CACHE.customers,
          fetchPage: bindCrmListFetch(listCustomers),
          mapItem: mapCustomerFromApi,
          signal: controller.signal,
          force,
          onFirstPage: trackFirst(setCustomers),
          onComplete: trackComplete(setCustomers),
        }),
        loadProgressiveCrmList({
          cachePrefix: CRM_CACHE.itineraries,
          fetchPage: bindCrmListFetch(listItineraries),
          mapItem: mapItineraryFromApi,
          signal: controller.signal,
          force,
          onFirstPage: trackFirst(setItineraries),
          onComplete: trackComplete(setItineraries),
        }),
        loadProgressiveCrmList({
          cachePrefix: CRM_CACHE.vendors,
          fetchPage: bindCrmListFetch(listVendors),
          mapItem: mapVendorFromApi,
          signal: controller.signal,
          force,
          onFirstPage: trackFirst(setVendors),
          onComplete: trackComplete(setVendors),
        }),
      ]);
    } finally {
      setLoading(false);
    }

    return () => controller.abort();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (cancelled) return;
      try {
        await loadAll(false);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load finance data");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAll]);

  const replaceInvoiceInState = useCallback((apiInvoice: Parameters<typeof mapInvoiceFromApi>[0]) => {
    const record = mapInvoiceFromApi(apiInvoice);
    setInvoices((prev) => {
      const idx = prev.findIndex((i) => i.id === record.id);
      if (idx === -1) return [record, ...prev];
      const next = [...prev];
      next[idx] = record;
      return next;
    });
    return record;
  }, []);

  const addInvoice = useCallback(
    async (input: InvoiceCreateInput) => {
      const apiInvoice = await createInvoiceApi(input);
      invalidateCrmListCache(CRM_CACHE.invoices);
      return replaceInvoiceInState(apiInvoice);
    },
    [replaceInvoiceInState],
  );

  const updateInvoice = useCallback(
    async (invoiceId: string, input: InvoiceUpdateInput) => {
      const apiInvoice = await updateInvoiceApi(invoiceId, input);
      invalidateCrmListCache(CRM_CACHE.invoices);
      return replaceInvoiceInState(apiInvoice);
    },
    [replaceInvoiceInState],
  );

  const recordPayment = useCallback(
    async (invoiceId: string, amount: number, method: string, ref?: string) => {
      const optimisticId = `optimistic-${Date.now()}`;
      const optimisticPayment: Payment = {
        id: optimisticId,
        agencyId: invoices.find((i) => i.id === invoiceId)?.agencyId ?? "",
        invoiceId,
        amount,
        paymentMethod: method,
        transactionReference: ref ?? "",
        paymentDate: new Date().toISOString(),
      };
      setPayments((prev) => [optimisticPayment, ...prev]);
      prependCrmWorkspaceItem(CRM_CACHE.payments, optimisticPayment);

      try {
        const apiPayment = await createPaymentApi({
          invoiceId,
          amount,
          paymentMethod: method,
          transactionReference: ref,
        });
        invalidateCrmListCache(CRM_CACHE.payments);
        const payment = mapPaymentFromApi(apiPayment);
        setPayments((prev) =>
          prev.map((p) => (p.id === optimisticId ? payment : p)),
        );
        const apiInvoice = await getInvoice(invoiceId);
        replaceInvoiceInState(apiInvoice);
        return payment;
      } catch (error) {
        setPayments((prev) => prev.filter((p) => p.id !== optimisticId));
        removeCrmWorkspaceItem(CRM_CACHE.payments, optimisticId);
        throw error;
      }
    },
    [invoices, replaceInvoiceInState],
  );

  const addExpense = useCallback(async (input: ExpenseCreateInput) => {
    const apiExpense = await createExpenseApi(input);
    invalidateCrmListCache(CRM_CACHE.expenses);
    const record = mapExpenseFromApi(apiExpense);
    setExpenses((prev) => [record, ...prev]);
    return record;
  }, []);

  const updateExpense = useCallback(async (expenseId: string, input: ExpenseCreateInput) => {
    const apiExpense = await updateExpenseApi(expenseId, input);
    invalidateCrmListCache(CRM_CACHE.expenses);
    const record = mapExpenseFromApi(apiExpense);
    setExpenses((prev) => prev.map((e) => (e.id === expenseId ? record : e)));
    return record;
  }, []);

  const deleteExpense = useCallback(async (expenseId: string) => {
    const snapshot = expenses.find((e) => e.id === expenseId);
    setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
    removeCrmWorkspaceItem(CRM_CACHE.expenses, expenseId);

    try {
      await deleteExpenseApi(expenseId);
      invalidateCrmListCache(CRM_CACHE.expenses);
    } catch (error) {
      if (snapshot) {
        setExpenses((prev) => [snapshot, ...prev]);
        prependCrmWorkspaceItem(CRM_CACHE.expenses, snapshot);
      }
      throw error;
    }
  }, [expenses]);

  return {
    invoices,
    payments,
    expenses,
    vendorPayouts,
    bookings,
    customers,
    itineraries,
    vendors,
    loading,
    backgroundLoading,
    error,
    addInvoice,
    updateInvoice,
    recordPayment,
    addExpense,
    updateExpense,
    deleteExpense,
    refresh: () => loadAll(true),
  };
}
