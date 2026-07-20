"use client";

import { listBookings, mapBookingFromApi } from "@/lib/api/bookings";
import { listInvoices, mapInvoiceFromApi } from "@/lib/api/finance";
import { CRM_CACHE } from "@/lib/api/crm-workspace-store";
import { bindCrmListFetch } from "@/lib/api/pagination";
import { useProgressiveCrmList } from "@/hooks/useProgressiveCrmList";

export function useBookingsInvoices(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const {
    items: bookings,
    loading: bookingsLoading,
    backgroundLoading: bookingsBackgroundLoading,
    refresh: refreshBookings,
  } = useProgressiveCrmList({
    cachePrefix: CRM_CACHE.bookings,
    fetchPage: bindCrmListFetch(listBookings),
    mapItem: mapBookingFromApi,
    enabled,
  });

  const {
    items: invoices,
    loading: invoicesLoading,
    backgroundLoading: invoicesBackgroundLoading,
    refresh: refreshInvoices,
  } = useProgressiveCrmList({
    cachePrefix: CRM_CACHE.invoices,
    fetchPage: bindCrmListFetch(listInvoices),
    mapItem: mapInvoiceFromApi,
    enabled,
  });

  const loading = bookingsLoading || invoicesLoading;
  const backgroundLoading = bookingsBackgroundLoading || invoicesBackgroundLoading;

  const refresh = async () => {
    await Promise.all([refreshBookings(), refreshInvoices()]);
  };

  return {
    bookings,
    invoices,
    loading,
    backgroundLoading,
    refresh,
  };
}
