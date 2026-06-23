"use client";

import { useCallback, useEffect, useState } from "react";
import { listBookings, mapBookingFromApi } from "@/lib/api/bookings";
import { listCustomers, mapCustomerFromApi } from "@/lib/api/customers";
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
import { CRM_API_DEFAULT_PAGE_SIZE } from "@/lib/api/pagination";
import { listVendors, mapVendorFromApi } from "@/lib/api/vendors";
import type { Booking, Customer, Expense, Invoice, Itinerary, Payment, Vendor, VendorPayout } from "@/lib/store";

export function useFinancePage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vendorPayouts, setVendorPayouts] = useState<VendorPayout[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setError(null);
    const [
      invoiceData,
      paymentData,
      expenseData,
      payoutData,
      bookingData,
      customerData,
      itineraryData,
      vendorData,
    ] = await Promise.all([
      listInvoices({ limit: CRM_API_DEFAULT_PAGE_SIZE }),
      listPayments({ limit: CRM_API_DEFAULT_PAGE_SIZE }),
      listExpenses({ limit: CRM_API_DEFAULT_PAGE_SIZE }),
      listVendorPayouts({ limit: CRM_API_DEFAULT_PAGE_SIZE }),
      listBookings({ limit: CRM_API_DEFAULT_PAGE_SIZE }),
      listCustomers({ limit: CRM_API_DEFAULT_PAGE_SIZE }),
      listItineraries({ limit: CRM_API_DEFAULT_PAGE_SIZE }),
      listVendors({ limit: CRM_API_DEFAULT_PAGE_SIZE }),
    ]);
    setInvoices(invoiceData.items.map(mapInvoiceFromApi));
    setPayments(paymentData.items.map(mapPaymentFromApi));
    setExpenses(expenseData.items.map(mapExpenseFromApi));
    setVendorPayouts(payoutData.items.map(mapVendorPayoutFromApi));
    setBookings(bookingData.items.map(mapBookingFromApi));
    setCustomers(customerData.items.map(mapCustomerFromApi));
    setItineraries(itineraryData.items.map((item) => mapItineraryFromApi(item)));
    setVendors(vendorData.items.map(mapVendorFromApi));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await loadAll();
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load finance data");
        }
      } finally {
        if (!cancelled) setLoading(false);
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
      return replaceInvoiceInState(apiInvoice);
    },
    [replaceInvoiceInState],
  );

  const updateInvoice = useCallback(
    async (invoiceId: string, input: InvoiceUpdateInput) => {
      const apiInvoice = await updateInvoiceApi(invoiceId, input);
      return replaceInvoiceInState(apiInvoice);
    },
    [replaceInvoiceInState],
  );

  const recordPayment = useCallback(
    async (invoiceId: string, amount: number, method: string, ref?: string) => {
      const apiPayment = await createPaymentApi({
        invoiceId,
        amount,
        paymentMethod: method,
        transactionReference: ref,
      });
      const payment = mapPaymentFromApi(apiPayment);
      setPayments((prev) => [payment, ...prev]);
      const apiInvoice = await getInvoice(invoiceId);
      replaceInvoiceInState(apiInvoice);
      return payment;
    },
    [replaceInvoiceInState],
  );

  const addExpense = useCallback(async (input: ExpenseCreateInput) => {
    const apiExpense = await createExpenseApi(input);
    const record = mapExpenseFromApi(apiExpense);
    setExpenses((prev) => [record, ...prev]);
    return record;
  }, []);

  const updateExpense = useCallback(async (expenseId: string, input: ExpenseCreateInput) => {
    const apiExpense = await updateExpenseApi(expenseId, input);
    const record = mapExpenseFromApi(apiExpense);
    setExpenses((prev) => prev.map((e) => (e.id === expenseId ? record : e)));
    return record;
  }, []);

  const deleteExpense = useCallback(async (expenseId: string) => {
    await deleteExpenseApi(expenseId);
    setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
  }, []);

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
    error,
    addInvoice,
    updateInvoice,
    recordPayment,
    addExpense,
    updateExpense,
    deleteExpense,
    refresh: loadAll,
  };
}
