"use client";

import { useEffect, useMemo, useState } from "react";
import { listAuditLogs, mapAuditLogFromApi } from "@/lib/api/audit-logs";
import { listBookings, mapBookingFromApi } from "@/lib/api/bookings";
import {
  listExpenses,
  listInvoices,
  listPayments,
  mapExpenseFromApi,
  mapInvoiceFromApi,
  mapPaymentFromApi,
} from "@/lib/api/finance";
import { applyLeadRecord, listLeads, loadLeadExtras } from "@/lib/api/leads";
import { listItineraries, mapItineraryFromApi } from "@/lib/api/itineraries";
import { bindCrmListFetch } from "@/lib/api/pagination";
import { loadProgressiveCrmList } from "@/lib/api/progressive-list";
import { CRM_CACHE, getCrmWorkspaceList } from "@/lib/api/crm-workspace-store";
import { listAgencyUsers, userNameMap } from "@/lib/api/users";
import type { AuditLog, Booking, Expense, Invoice, Itinerary, Lead, Payment, User } from "@/lib/store";

export type AgentPerformanceRow = {
  name: string;
  assigned: number;
  confirmed: number;
  rate: number;
  volume: number;
};

export type ConversionSlice = {
  name: string;
  value: number;
  color: string;
};

export type RevenueTrendPoint = {
  date: string;
  Revenue: number;
  Expenses: number;
};

const STAGE_COLORS: Record<string, string> = {
  NEW: "#6366f1",
  CONTACTED: "#38bdf8",
  PROPOSAL_SENT: "#f59e0b",
  NEGOTIATION: "#ec4899",
  CONFIRMED: "#10b981",
  LOST: "#6b7280",
};

const STAGE_LABELS: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  PROPOSAL_SENT: "Proposal Sent",
  NEGOTIATION: "Negotiation",
  CONFIRMED: "Confirmed",
  LOST: "Lost",
};

function weeklyLeadGrowthPercent(leads: Lead[]): number {
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const thisWeek = leads.filter((l) => now - new Date(l.createdAt).getTime() <= weekMs).length;
  const lastWeek = leads.filter((l) => {
    const age = now - new Date(l.createdAt).getTime();
    return age > weekMs && age <= 2 * weekMs;
  }).length;
  if (lastWeek === 0) return thisWeek > 0 ? 100 : 0;
  return Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
}

function revenueTrendByWeek(payments: Payment[], expenses: Expense[]): RevenueTrendPoint[] {
  const buckets: Record<string, { Revenue: number; Expenses: number }> = {};
  const addToBucket = (iso: string, key: "Revenue" | "Expenses", amount: number) => {
    const d = new Date(iso);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const label = weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    if (!buckets[label]) buckets[label] = { Revenue: 0, Expenses: 0 };
    buckets[label][key] += amount;
  };

  payments.forEach((p) => addToBucket(p.paymentDate, "Revenue", Number(p.amount)));
  expenses.forEach((e) => addToBucket(e.expenseDate, "Expenses", Number(e.amount)));

  return Object.entries(buckets)
    .slice(-4)
    .map(([date, values]) => ({ date, ...values }));
}

export function useDashboardPage() {
  const cachedLeads = getCrmWorkspaceList<Lead>(CRM_CACHE.leads);
  const cachedItineraries = getCrmWorkspaceList<Itinerary>(CRM_CACHE.itineraries);
  const cachedBookings = getCrmWorkspaceList<Booking>(CRM_CACHE.bookings);
  const cachedInvoices = getCrmWorkspaceList<Invoice>(CRM_CACHE.invoices);
  const cachedPayments = getCrmWorkspaceList<Payment>(CRM_CACHE.payments);
  const cachedExpenses = getCrmWorkspaceList<Expense>(CRM_CACHE.expenses);
  const cachedAudit = getCrmWorkspaceList<AuditLog>(CRM_CACHE.auditLogs);
  const hasWarmCache =
    cachedLeads ||
    cachedItineraries ||
    cachedBookings ||
    cachedInvoices ||
    cachedPayments ||
    cachedExpenses ||
    cachedAudit;

  const [leads, setLeads] = useState<Lead[]>(() => cachedLeads?.items ?? []);
  const [itineraries, setItineraries] = useState<Itinerary[]>(
    () => cachedItineraries?.items ?? [],
  );
  const [bookings, setBookings] = useState<Booking[]>(() => cachedBookings?.items ?? []);
  const [invoices, setInvoices] = useState<Invoice[]>(() => cachedInvoices?.items ?? []);
  const [payments, setPayments] = useState<Payment[]>(() => cachedPayments?.items ?? []);
  const [expenses, setExpenses] = useState<Expense[]>(() => cachedExpenses?.items ?? []);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => cachedAudit?.items ?? []);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(() => !hasWarmCache);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    let pendingBackground = 0;

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
        const staff = await listAgencyUsers();
        const names = userNameMap(staff);
        const extras = loadLeadExtras();
        if (cancelled) return;
        setUsers(staff);

        await Promise.all([
          loadProgressiveCrmList<
            Awaited<ReturnType<typeof listLeads>>["items"][number],
            Lead
          >({
            cachePrefix: CRM_CACHE.leads,
            fetchPage: bindCrmListFetch(listLeads),
            mapItem: (item) => applyLeadRecord(item, names, extras),
            signal: controller.signal,
            onFirstPage: trackFirst(setLeads),
            onComplete: trackComplete(setLeads),
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
            cachePrefix: CRM_CACHE.expenses,
            fetchPage: bindCrmListFetch(listExpenses),
            mapItem: mapExpenseFromApi,
            signal: controller.signal,
            onFirstPage: trackFirst(setExpenses),
            onComplete: trackComplete(setExpenses),
          }),
          loadProgressiveCrmList<
            Awaited<ReturnType<typeof listAuditLogs>>["items"][number],
            AuditLog
          >({
            cachePrefix: CRM_CACHE.auditLogs,
            fetchPage: bindCrmListFetch(listAuditLogs),
            mapItem: (item) => mapAuditLogFromApi(item, names),
            signal: controller.signal,
            onFirstPage: trackFirst(setAuditLogs),
            onComplete: (items) => {
              const sorted = [...items].sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
              );
              trackComplete(setAuditLogs)(sorted);
            },
          }),
        ]);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load dashboard data");
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

  const metrics = useMemo(() => {
    const totalLeadsCount = leads.length;
    const activeItinCount = itineraries.length;
    const bookingsCount = bookings.length;
    const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalInvoiced = invoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
    const pendingPayments = Math.max(0, totalInvoiced - totalRevenue);
    const weeklyLeadGrowth = weeklyLeadGrowthPercent(leads);
    const sentItineraries = itineraries.filter((i) => i.status === "SENT").length;
    const processingBookings = bookings.filter((b) => b.status === "PROCESSING").length;

    const stageCounts = leads.reduce<Record<string, number>>((acc, lead) => {
      acc[lead.status] = (acc[lead.status] || 0) + 1;
      return acc;
    }, {});

    const conversionData: ConversionSlice[] = Object.entries(STAGE_LABELS)
      .map(([status, name]) => ({
        name,
        value: stageCounts[status] || 0,
        color: STAGE_COLORS[status],
      }))
      .filter((item) => item.value > 0);

    const revenueTrendData = revenueTrendByWeek(payments, expenses);

    const agentPerformance: AgentPerformanceRow[] = users
      .map((agent) => {
        const assigned = leads.filter((l) => l.assignedToId === agent.id);
        const confirmed = assigned.filter((l) => l.status === "CONFIRMED");
        const salesVolume = confirmed.reduce((sum, l) => sum + Number(l.value), 0);
        const rate = assigned.length > 0 ? Math.round((confirmed.length / assigned.length) * 100) : 0;
        return {
          name: agent.name,
          assigned: assigned.length,
          confirmed: confirmed.length,
          rate,
          volume: salesVolume,
        };
      })
      .filter((row) => row.assigned > 0)
      .sort((a, b) => b.volume - a.volume);

    return {
      totalLeadsCount,
      activeItinCount,
      bookingsCount,
      totalRevenue,
      totalInvoiced,
      pendingPayments,
      paymentCount: payments.length,
      weeklyLeadGrowth,
      sentItineraries,
      processingBookings,
      conversionData,
      revenueTrendData,
      agentPerformance,
    };
  }, [leads, itineraries, bookings, invoices, payments, expenses, users]);

  return {
    loading,
    backgroundLoading,
    error,
    auditLogs,
    ...metrics,
  };
}
