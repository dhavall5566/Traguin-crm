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
import { CRM_API_DEFAULT_PAGE_SIZE, fetchAllPaginated } from "@/lib/api/pagination";
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

function revenueTrendByWeek(payments: Payment[], expenses: Expense[]): RevenueTrendPoint[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const weeks: RevenueTrendPoint[] = [
    { date: "Week 1", Revenue: 0, Expenses: 0 },
    { date: "Week 2", Revenue: 0, Expenses: 0 },
    { date: "Week 3", Revenue: 0, Expenses: 0 },
    { date: "Week 4", Revenue: 0, Expenses: 0 },
  ];

  for (const p of payments) {
    const d = new Date(p.paymentDate);
    if (d.getFullYear() !== year || d.getMonth() !== month) continue;
    const idx = Math.min(3, Math.floor((d.getDate() - 1) / 7));
    weeks[idx].Revenue += Number(p.amount);
  }
  for (const e of expenses) {
    const d = new Date(e.expenseDate);
    if (d.getFullYear() !== year || d.getMonth() !== month) continue;
    const idx = Math.min(3, Math.floor((d.getDate() - 1) / 7));
    weeks[idx].Expenses += Number(e.amount);
  }
  return weeks;
}

function weeklyLeadGrowthPercent(leads: Lead[]): number {
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const thisWeek = leads.filter((l) => now - new Date(l.createdAt).getTime() < weekMs).length;
  const prevWeek = leads.filter((l) => {
    const age = now - new Date(l.createdAt).getTime();
    return age >= weekMs && age < weekMs * 2;
  }).length;
  if (prevWeek === 0) return thisWeek > 0 ? 100 : 0;
  return Math.round(((thisWeek - prevWeek) / prevWeek) * 1000) / 10;
}

export function useDashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const staff = await listAgencyUsers();
        const names = userNameMap(staff);
        const extras = loadLeadExtras();
        const pageSize = CRM_API_DEFAULT_PAGE_SIZE;

        const [
          leadPage,
          itineraryPage,
          bookingItems,
          invoiceItems,
          paymentItems,
          expenseItems,
          auditItems,
        ] = await Promise.all([
          listLeads({ limit: pageSize }),
          listItineraries({ limit: pageSize }),
          fetchAllPaginated((offset, limit) => listBookings({ offset, limit }), pageSize),
          fetchAllPaginated((offset, limit) => listInvoices({ offset, limit }), pageSize),
          fetchAllPaginated((offset, limit) => listPayments({ offset, limit }), pageSize),
          fetchAllPaginated((offset, limit) => listExpenses({ offset, limit }), pageSize),
          fetchAllPaginated((offset, limit) => listAuditLogs({ offset, limit }), pageSize),
        ]);

        if (cancelled) return;

        setUsers(staff);
        setLeads(leadPage.items.map((item) => applyLeadRecord(item, names, extras)));
        setItineraries(itineraryPage.items.map((item) => mapItineraryFromApi(item)));
        setBookings(bookingItems.map(mapBookingFromApi));
        setInvoices(invoiceItems.map(mapInvoiceFromApi));
        setPayments(paymentItems.map(mapPaymentFromApi));
        setExpenses(expenseItems.map(mapExpenseFromApi));
        setAuditLogs(
          auditItems
            .map((item) => mapAuditLogFromApi(item, names))
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
        );
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
    error,
    auditLogs,
    ...metrics,
  };
}
