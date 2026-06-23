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
import { CRM_API_DEFAULT_PAGE_SIZE, fetchAllPaginated } from "@/lib/api/pagination";
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
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadNotes, setLeadNotes] = useState<LeadNote[]>([]);
  const [leadActivities, setLeadActivities] = useState<LeadActivity[]>([]);
  const [leadFollowups, setLeadFollowups] = useState<LeadFollowup[]>([]);
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const pageSize = CRM_API_DEFAULT_PAGE_SIZE;
        const [staff, extras, leadPage, itineraryPage, pendingFollowups, bookingItems, invoiceItems, paymentItems, customerItems] =
          await Promise.all([
            listAgencyUsers(),
            Promise.resolve(loadLeadExtras()),
            listLeads({ limit: pageSize }),
            listItineraries({ limit: pageSize }),
            listPendingLeadFollowups(),
            fetchAllPaginated((offset, limit) => listBookings({ offset, limit }), pageSize),
            fetchAllPaginated((offset, limit) => listInvoices({ offset, limit }), pageSize),
            fetchAllPaginated((offset, limit) => listPayments({ offset, limit }), pageSize),
            fetchAllPaginated((offset, limit) => listCustomers({ offset, limit }), pageSize),
          ]);

        if (cancelled) return;

        const names = userNameMap(staff);
        const records = leadPage.items.map((item) => applyLeadRecord(item, names, extras));
        setUsers(staff);
        setLeads(records);
        setLeadNotes(records.flatMap((l) => l.notes));
        setLeadActivities(records.flatMap((l) => l.activities));
        setLeadFollowups(pendingFollowups.map((f) => mapFollowupFromApi(f, names)));
        setItineraries(itineraryPage.items.map((item) => mapItineraryFromApi(item)));
        setBookings(bookingItems.map(mapBookingFromApi));
        setInvoices(invoiceItems.map(mapInvoiceFromApi));
        setPayments(paymentItems.map(mapPaymentFromApi));
        setCustomers(customerItems.map(mapCustomerFromApi));
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
    error,
    users,
    calendarEvents,
    untouched24,
    proposals7,
  };
}
