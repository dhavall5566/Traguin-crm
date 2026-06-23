"use client";

import { useEffect, useMemo, useState } from "react";
import { listBookings, mapBookingFromApi } from "@/lib/api/bookings";
import { listCustomers, mapCustomerFromApi } from "@/lib/api/customers";
import {
  listInvoices,
  listPayments,
  mapInvoiceFromApi,
  mapPaymentFromApi,
} from "@/lib/api/finance";
import {
  applyLeadRecord,
  listLeads,
  listPendingLeadFollowups,
  loadLeadExtras,
  mapFollowupFromApi,
} from "@/lib/api/leads";
import { listItineraries, mapItineraryFromApi } from "@/lib/api/itineraries";
import { bindCrmListFetch } from "@/lib/api/pagination";
import { loadProgressiveCrmList } from "@/lib/api/progressive-list";
import { CRM_CACHE, getCrmWorkspaceList } from "@/lib/api/crm-workspace-store";
import { listAgencyUsers, userNameMap } from "@/lib/api/users";
import type {
  Booking,
  Customer,
  Invoice,
  Itinerary,
  Lead,
  LeadActivity,
  LeadFollowup,
  LeadNote,
  Payment,
  User,
} from "@/lib/store";
import {
  buildWeekCalendarEvents,
  getStuckProposalLeads,
  getUntouchedStaleLeads,
  type OpsCalendarEvent,
  type StuckProposalLeadRow,
  type UntouchedStaleLeadRow,
} from "@/lib/weekly-ops-logic";

export function useOperationsPage(weekStart: Date, slaNow: Date | null) {
  const cachedLeads = getCrmWorkspaceList<Lead>(CRM_CACHE.leads);
  const cachedItineraries = getCrmWorkspaceList<Itinerary>(CRM_CACHE.itineraries);
  const cachedBookings = getCrmWorkspaceList<Booking>(CRM_CACHE.bookings);
  const cachedInvoices = getCrmWorkspaceList<Invoice>(CRM_CACHE.invoices);
  const cachedPayments = getCrmWorkspaceList<Payment>(CRM_CACHE.payments);
  const cachedCustomers = getCrmWorkspaceList<Customer>(CRM_CACHE.customers);
  const hasWarmCache =
    cachedLeads ||
    cachedItineraries ||
    cachedBookings ||
    cachedInvoices ||
    cachedPayments ||
    cachedCustomers;

  const [leads, setLeads] = useState<Lead[]>(() => cachedLeads?.items ?? []);
  const [leadNotes, setLeadNotes] = useState<LeadNote[]>([]);
  const [leadActivities, setLeadActivities] = useState<LeadActivity[]>([]);
  const [leadFollowups, setLeadFollowups] = useState<LeadFollowup[]>([]);
  const [itineraries, setItineraries] = useState<Itinerary[]>(
    () => cachedItineraries?.items ?? [],
  );
  const [bookings, setBookings] = useState<Booking[]>(() => cachedBookings?.items ?? []);
  const [invoices, setInvoices] = useState<Invoice[]>(() => cachedInvoices?.items ?? []);
  const [payments, setPayments] = useState<Payment[]>(() => cachedPayments?.items ?? []);
  const [customers, setCustomers] = useState<Customer[]>(() => cachedCustomers?.items ?? []);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(() => !hasWarmCache);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    let pendingBackground = 0;

    const applyLeadRecords = (records: ReturnType<typeof applyLeadRecord>[]) => {
      setLeads(records);
      setLeadNotes(records.flatMap((l) => l.notes));
      setLeadActivities(records.flatMap((l) => l.activities));
    };

    const trackFirst =
      <T,>(setter: (items: T[]) => void) =>
      (items: T[], total: number) => {
        setter(items);
        if (items.length < total) {
          pendingBackground += 1;
          setBackgroundLoading(true);
        }
      };

    const trackComplete =
      <T,>(setter: (items: T[]) => void) =>
      (items: T[]) => {
        setter(items);
        pendingBackground = Math.max(0, pendingBackground - 1);
        if (pendingBackground === 0) setBackgroundLoading(false);
      };

    (async () => {
      if (!hasWarmCache) setLoading(true);
      setBackgroundLoading(false);
      setError(null);
      try {
        const [staff, extras, pendingFollowups] = await Promise.all([
          listAgencyUsers(),
          Promise.resolve(loadLeadExtras()),
          listPendingLeadFollowups(),
        ]);
        if (cancelled) return;

        const names = userNameMap(staff);
        setUsers(staff);
        setLeadFollowups(pendingFollowups.map((f) => mapFollowupFromApi(f, names)));

        await Promise.all([
          loadProgressiveCrmList<
            Awaited<ReturnType<typeof listLeads>>["items"][number],
            ReturnType<typeof applyLeadRecord>
          >({
            cachePrefix: CRM_CACHE.leads,
            fetchPage: bindCrmListFetch(listLeads),
            mapItem: (item) => applyLeadRecord(item, names, extras),
            signal: controller.signal,
            onFirstPage: (firstItems, firstTotal) => {
              if (cancelled) return;
              applyLeadRecords(firstItems);
              if (firstItems.length < firstTotal) {
                pendingBackground += 1;
                setBackgroundLoading(true);
              }
            },
            onComplete: (allItems) => {
              if (cancelled) return;
              applyLeadRecords(allItems);
              pendingBackground = Math.max(0, pendingBackground - 1);
              if (pendingBackground === 0) setBackgroundLoading(false);
            },
          }),
          loadProgressiveCrmList({
            cachePrefix: CRM_CACHE.itineraries,
            fetchPage: bindCrmListFetch(listItineraries),
            mapItem: mapItineraryFromApi,
            signal: controller.signal,
            onFirstPage: trackFirst(setItineraries),
            onComplete: trackComplete(setItineraries),
          }),
          loadProgressiveCrmList({
            cachePrefix: CRM_CACHE.bookings,
            fetchPage: bindCrmListFetch(listBookings),
            mapItem: mapBookingFromApi,
            signal: controller.signal,
            onFirstPage: trackFirst(setBookings),
            onComplete: trackComplete(setBookings),
          }),
          loadProgressiveCrmList({
            cachePrefix: CRM_CACHE.invoices,
            fetchPage: bindCrmListFetch(listInvoices),
            mapItem: mapInvoiceFromApi,
            signal: controller.signal,
            onFirstPage: trackFirst(setInvoices),
            onComplete: trackComplete(setInvoices),
          }),
          loadProgressiveCrmList({
            cachePrefix: CRM_CACHE.payments,
            fetchPage: bindCrmListFetch(listPayments),
            mapItem: mapPaymentFromApi,
            signal: controller.signal,
            onFirstPage: trackFirst(setPayments),
            onComplete: trackComplete(setPayments),
          }),
          loadProgressiveCrmList({
            cachePrefix: CRM_CACHE.customers,
            fetchPage: bindCrmListFetch(listCustomers),
            mapItem: mapCustomerFromApi,
            signal: controller.signal,
            onFirstPage: trackFirst(setCustomers),
            onComplete: trackComplete(setCustomers),
          }),
        ]);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load operations data");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const calendarEvents = useMemo(
    (): OpsCalendarEvent[] =>
      buildWeekCalendarEvents(
        itineraries,
        leadFollowups,
        invoices,
        bookings,
        payments,
        leads,
        customers,
        weekStart,
      ),
    [itineraries, leadFollowups, invoices, bookings, payments, leads, customers, weekStart],
  );

  const untouched24 = useMemo(
    (): UntouchedStaleLeadRow[] =>
      slaNow
        ? getUntouchedStaleLeads(leads, leadNotes, leadActivities, leadFollowups, slaNow, 24)
        : [],
    [leads, leadNotes, leadActivities, leadFollowups, slaNow],
  );

  const proposals7 = useMemo(
    (): StuckProposalLeadRow[] =>
      slaNow
        ? getStuckProposalLeads(
            leads,
            customers,
            bookings,
            invoices,
            payments,
            leadActivities,
            slaNow,
            7,
          )
        : [],
    [leads, customers, bookings, invoices, payments, leadActivities, slaNow],
  );

  return {
    loading,
    backgroundLoading,
    error,
    users,
    calendarEvents,
    untouched24,
    proposals7,
  };
}
